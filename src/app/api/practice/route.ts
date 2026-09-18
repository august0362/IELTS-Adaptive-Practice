import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { skills, skillParts, questionTypes, rollSessions, rollResults, rollResultQuestionTypes } from "@/lib/db/schema";
import { loadEngineConfig } from "@/lib/db/configHelpers";
import { readJsonObject } from "@/lib/api/requestJson";
import { applyCountSoftReset } from "@/lib/engine/countSoftReset";

/**
 * Logs practice done *without* the Spinner (PROJECT_CONTEXT.md section 5.8) —
 * for whenever the user studies a skill on their own initiative. Writes the
 * same rollSessions/rollResults/rollResultQuestionTypes rows a real roll
 * would (source = "manual" instead of "roll"), so it participates in Formula
 * 1's fairness counters and Formula 3's 30-day frequency nudge identically to
 * an actual roll — the only difference is the user picked skill/part/type by
 * hand instead of the engine rolling them.
 */
export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { skillCode, partCode, questionTypeCode } = parsed.body;

  if (typeof skillCode !== "string" || typeof partCode !== "string") {
    return NextResponse.json({ error: "skillCode and partCode (strings) are required" }, { status: 400 });
  }
  if (questionTypeCode !== undefined && typeof questionTypeCode !== "string") {
    return NextResponse.json({ error: "questionTypeCode must be a string when provided" }, { status: 400 });
  }

  const now = new Date();

  const outcome = db.transaction((tx) => {
    const [skill] = tx.select().from(skills).where(eq(skills.code, skillCode)).all();
    if (!skill) return { error: `Unknown skillCode: ${skillCode}` as const };

    const [part] = tx.select().from(skillParts).where(eq(skillParts.code, partCode)).all();
    if (!part || part.skillId !== skill.id) {
      return { error: `Unknown partCode for this skill: ${partCode}` as const };
    }

    let type: typeof questionTypes.$inferSelect | undefined;
    if (questionTypeCode !== undefined) {
      if (part.questionTypeRollCount === 0) {
        return { error: "This part has no question types" as const };
      }
      [type] = tx.select().from(questionTypes).where(eq(questionTypes.code, questionTypeCode)).all();
      if (!type || type.skillId !== skill.id) {
        return { error: `Unknown questionTypeCode for this skill: ${questionTypeCode}` as const };
      }
    }

    const engineConfig = loadEngineConfig(tx);

    const [session] = tx.insert(rollSessions).values({ rolledAt: now, source: "manual" }).returning().all();
    const [result] = tx
      .insert(rollResults)
      .values({ rollSessionId: session.id, skillId: skill.id, skillPartId: part.id })
      .returning()
      .all();

    tx.update(skills)
      .set({ occurrenceCount: sql`${skills.occurrenceCount} + 1`, lastAppearedAt: now })
      .where(eq(skills.id, skill.id))
      .run();
    tx.update(skillParts)
      .set({ occurrenceCount: sql`${skillParts.occurrenceCount} + 1`, lastAppearedAt: now })
      .where(eq(skillParts.id, part.id))
      .run();

    if (type) {
      tx.insert(rollResultQuestionTypes).values({ rollResultId: result.id, questionTypeId: type.id }).run();
      tx.update(questionTypes)
        .set({ occurrenceCount: sql`${questionTypes.occurrenceCount} + 1`, lastAppearedAt: now })
        .where(eq(questionTypes.id, type.id))
        .run();
    }

    // Same soft-reset safeguard as a real roll (PROJECT_CONTEXT.md 5.2.1).
    const refreshedSkills = tx.select().from(skills).all();
    const skillReset = applyCountSoftReset(refreshedSkills, engineConfig.countSoftResetThreshold);
    if (skillReset.didReset) {
      for (const s of skillReset.items) {
        tx.update(skills).set({ occurrenceCount: s.occurrenceCount }).where(eq(skills.id, s.id)).run();
      }
    }

    const parts = tx.select().from(skillParts).where(eq(skillParts.skillId, skill.id)).all();
    const partReset = applyCountSoftReset(parts, engineConfig.countSoftResetThreshold);
    if (partReset.didReset) {
      for (const p of partReset.items) {
        tx.update(skillParts).set({ occurrenceCount: p.occurrenceCount }).where(eq(skillParts.id, p.id)).run();
      }
    }

    const typesInPool = tx.select().from(questionTypes).where(eq(questionTypes.skillId, skill.id)).all();
    const typeReset = applyCountSoftReset(typesInPool, engineConfig.countSoftResetThreshold);
    if (typeReset.didReset) {
      for (const t of typeReset.items) {
        tx.update(questionTypes).set({ occurrenceCount: t.occurrenceCount }).where(eq(questionTypes.id, t.id)).run();
      }
    }

    return {
      sessionId: session.id,
      source: "manual" as const,
      skill: { id: skill.id, code: skill.code, name: skill.name },
      part: { id: part.id, code: part.code, name: part.name },
      questionType: type ? { id: type.id, code: type.code, name: type.name } : null,
    };
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
