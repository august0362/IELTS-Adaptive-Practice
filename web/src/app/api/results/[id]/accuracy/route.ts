import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rollResults, skills } from "@/lib/db/schema";
import { readJsonObject } from "@/lib/api/requestJson";

const ACCURACY_SKILL_CODES = new Set(["READING", "LISTENING"]);

/**
 * Attaches a practice-accuracy entry (questions answered/correct) to an
 * already-created roll/manual-practice result — filled in after the user
 * finishes that Reading/Listening session, not at roll time (PROJECT_CONTEXT.md
 * section 5.4 v2 / 5.8). Reading/Listening only: Writing/Speaking have no
 * objective right/wrong signal.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { questionsAnswered, questionsCorrect } = parsed.body;

  if (!Number.isInteger(questionsAnswered) || !Number.isInteger(questionsCorrect)) {
    return NextResponse.json({ error: "questionsAnswered and questionsCorrect must be integers" }, { status: 400 });
  }
  if (questionsAnswered <= 0) {
    return NextResponse.json({ error: "questionsAnswered must be > 0" }, { status: 400 });
  }
  if (questionsCorrect < 0 || questionsCorrect > questionsAnswered) {
    return NextResponse.json({ error: "questionsCorrect must be between 0 and questionsAnswered" }, { status: 400 });
  }

  const [result] = await db.select().from(rollResults).where(eq(rollResults.id, id));
  if (!result) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  const [skill] = await db.select().from(skills).where(eq(skills.id, result.skillId));
  if (!skill || !ACCURACY_SKILL_CODES.has(skill.code)) {
    return NextResponse.json({ error: "Accuracy only applies to Reading/Listening results" }, { status: 400 });
  }

  const [updated] = await db
    .update(rollResults)
    .set({ questionsAnswered, questionsCorrect })
    .where(eq(rollResults.id, id))
    .returning();

  return NextResponse.json({
    id: updated.id,
    questionsAnswered: updated.questionsAnswered,
    questionsCorrect: updated.questionsCorrect,
  });
}
