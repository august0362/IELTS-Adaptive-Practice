import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cambridgeTestResults } from "@/lib/db/schema";
import { ieltsRound } from "@/lib/engine/ieltsRounding";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const existing = await db.query.cambridgeTestResults.findFirst({ where: eq(cambridgeTestResults.id, id) });
  if (!existing) {
    return NextResponse.json({ error: "Cambridge test result not found" }, { status: 404 });
  }

  const patch: Partial<typeof cambridgeTestResults.$inferInsert> = {};
  if (typeof body.testName === "string") patch.testName = body.testName;
  if (body.testDate) patch.testDate = new Date(body.testDate);
  if (typeof body.note === "string") patch.note = body.note;

  const merged = {
    readingBand: body.readingBand ?? existing.readingBand,
    listeningBand: body.listeningBand ?? existing.listeningBand,
    writingBand: body.writingBand ?? existing.writingBand,
    speakingBand: body.speakingBand ?? existing.speakingBand,
  };
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value !== "number" || value < 0 || value > 9) {
      return NextResponse.json({ error: `${key} must be a number between 0 and 9` }, { status: 400 });
    }
  }
  Object.assign(patch, merged);
  patch.overallBand = ieltsRound(
    (merged.readingBand + merged.listeningBand + merged.writingBand + merged.speakingBand) / 4
  );

  const [updated] = await db
    .update(cambridgeTestResults)
    .set(patch)
    .where(eq(cambridgeTestResults.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deleted] = await db.delete(cambridgeTestResults).where(eq(cambridgeTestResults.id, id)).returning();
  if (!deleted) {
    return NextResponse.json({ error: "Cambridge test result not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
