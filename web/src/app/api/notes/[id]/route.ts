import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyNotes } from "@/lib/db/schema";
import { readJsonObject } from "@/lib/api/requestJson";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { tags, content } = parsed.body;

  const patch: Partial<typeof dailyNotes.$inferInsert> = { updatedAt: new Date() };
  if (typeof tags === "string") patch.tags = tags;
  if (typeof content === "string") patch.content = content;

  const [updated] = await db.update(dailyNotes).set(patch).where(eq(dailyNotes.id, id)).returning();
  if (!updated) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deleted] = await db.delete(dailyNotes).where(eq(dailyNotes.id, id)).returning();
  if (!deleted) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
