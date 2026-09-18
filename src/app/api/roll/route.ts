import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { skills, skillParts, questionTypes, rollSessions, rollResults, rollResultQuestionTypes } from "@/lib/db/schema";
import { loadEngineConfig } from "@/lib/db/configHelpers";
import { pickSkillsWithWeeklyConstraint } from "@/lib/engine/weeklyConstraint";
import { pickWeighted, pickWeightedIndependent } from "@/lib/engine/weightedRandom";
import { applyCountSoftReset } from "@/lib/engine/countSoftReset";

/**
 * Runs the whole roll (read current state, pick 2 skills + their parts, write
 * the new RollSession/RollResult rows, bump counters, apply the soft-reset
 * safeguard) inside a single synchronous transaction. better-sqlite3 requires
 * transaction callbacks to be synchronous — no `await` inside — hence the
 * `.all()` / `.run()` calls instead of the awaited style used elsewhere.
 */
export async function POST() {
  const now = new Date();

  const payload = db.transaction((tx) => {
    const engineConfig = loadEngineConfig(tx);
    const pickOptions = { decayExponent: engineConfig.decayExponent };

    const allSkills = tx.select().from(skills).all();
    const chosenSkills = pickSkillsWithWeeklyConstraint(
      allSkills,
      now,
      engineConfig.weeklyThresholdDays,
      2,
      pickOptions
    );

    const picks = chosenSkills.map((skill) => {
      const parts = tx.select().from(skillParts).where(eq(skillParts.skillId, skill.id)).all();
      const part = pickWeighted(parts, pickOptions);

      // Question-type sub-draws (PROJECT_CONTEXT.md section 5.7): independent
      // picks, repeats allowed, count = part.questionTypeRollCount (0 for
      // Speaking and Writing Task 2, which have no question types at all).
      let types: (typeof questionTypes.$inferSelect)[] = [];
      if (part.questionTypeRollCount > 0) {
        const typePool = tx.select().from(questionTypes).where(eq(questionTypes.skillId, skill.id)).all();
        types = pickWeightedIndependent(typePool, part.questionTypeRollCount, pickOptions);
      }

      return { skill, part, types };
    });

    const [session] = tx.insert(rollSessions).values({ rolledAt: now, source: "roll" }).returning().all();

    for (const { skill, part, types } of picks) {
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

      for (const type of types) {
        tx.insert(rollResultQuestionTypes).values({ rollResultId: result.id, questionTypeId: type.id }).run();
        tx.update(questionTypes)
          .set({ occurrenceCount: sql`${questionTypes.occurrenceCount} + 1`, lastAppearedAt: now })
          .where(eq(questionTypes.id, type.id))
          .run();
      }
    }

    // Soft-reset safeguard (PROJECT_CONTEXT.md section 5.2.1): rescale a pool's
    // counts if the max just crossed the threshold. Checked for the 4-skill
    // pool, each chosen skill's own 2-part pool, and each chosen skill's own
    // question-type pool.
    const refreshedSkills = tx.select().from(skills).all();
    const skillReset = applyCountSoftReset(refreshedSkills, engineConfig.countSoftResetThreshold);
    if (skillReset.didReset) {
      for (const s of skillReset.items) {
        tx.update(skills).set({ occurrenceCount: s.occurrenceCount }).where(eq(skills.id, s.id)).run();
      }
    }

    for (const { skill } of picks) {
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
    }

    return {
      sessionId: session.id,
      results: picks.map(({ skill, part, types }) => ({
        skill: { id: skill.id, code: skill.code, name: skill.name },
        part: { id: part.id, code: part.code, name: part.name },
        questionTypes: types.map((t) => ({ id: t.id, code: t.code, name: t.name })),
      })),
    };
  });

  return NextResponse.json(payload);
}
