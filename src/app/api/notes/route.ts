import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyNotes } from "@/lib/db/schema";
import { readJsonObject } from "@/lib/api/requestJson";
import { getAllNotes } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  const notes = dateParam
    ? await db
        .select()
        .from(dailyNotes)
        .where(eq(dailyNotes.noteDate, new Date(dateParam)))
        .orderBy(desc(dailyNotes.createdAt))
    : await getAllNotes();

  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { noteDate, tags, content } = parsed.body;

  if (!noteDate || typeof content !== "string" || content.length === 0) {
    return NextResponse.json({ error: "noteDate and non-empty content are required" }, { status: 400 });
  }

  const [created] = await db
    .insert(dailyNotes)
    .values({ noteDate: new Date(noteDate), tags: typeof tags === "string" ? tags : "", content })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
