import { NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { skillParts } from "@/lib/db/schema";
import { readJsonObject } from "@/lib/api/requestJson";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const baseRatio = Number(parsed.body.baseRatio);

  if (!Number.isFinite(baseRatio) || baseRatio < 0 || baseRatio > 1) {
    return NextResponse.json({ error: "baseRatio must be a number between 0 and 1" }, { status: 400 });
  }

  const part = await db.query.skillParts.findFirst({ where: eq(skillParts.id, id) });
  if (!part) {
    return NextResponse.json({ error: "Part not found" }, { status: 404 });
  }

  const sibling = await db.query.skillParts.findFirst({
    where: and(eq(skillParts.skillId, part.skillId), ne(skillParts.id, id)),
  });

  // Round to avoid float noise (e.g. 1 - 0.7 = 0.30000000000000004) leaking into the API response.
  const roundedRatio = Math.round(baseRatio * 1000) / 1000;
  const siblingRatio = Math.round((1 - baseRatio) * 1000) / 1000;

  await db.update(skillParts).set({ baseRatio: roundedRatio }).where(eq(skillParts.id, id));
  if (sibling) {
    await db.update(skillParts).set({ baseRatio: siblingRatio }).where(eq(skillParts.id, sibling.id));
  }

  const updated = await db.query.skillParts.findMany({ where: eq(skillParts.skillId, part.skillId) });
  return NextResponse.json(updated);
}
