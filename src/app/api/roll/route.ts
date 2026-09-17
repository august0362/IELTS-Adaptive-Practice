import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { skills, skillParts, rollSessions, rollResults } from "@/lib/db/schema";
import { loadEngineConfig } from "@/lib/db/configHelpers";
import { pickSkillsWithWeeklyConstraint } from "@/lib/engine/weeklyConstraint";
import { pickWeighted } from "@/lib/engine/weightedRandom";
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
      return { skill, part };
    });

    const [session] = tx.insert(rollSessions).values({ rolledAt: now }).returning().all();

    for (const { skill, part } of picks) {
      tx.insert(rollResults)
        .values({ rollSessionId: session.id, skillId: skill.id, skillPartId: part.id })
        .run();
      tx.update(skills)
        .set({ occurrenceCount: sql`${skills.occurrenceCount} + 1`, lastAppearedAt: now })
        .where(eq(skills.id, skill.id))
        .run();
      tx.update(skillParts)
        .set({ occurrenceCount: sql`${skillParts.occurrenceCount} + 1`, lastAppearedAt: now })
        .where(eq(skillParts.id, part.id))
        .run();
    }

    // Soft-reset safeguard (PROJECT_CONTEXT.md section 5.2.1): rescale a pool's
    // counts if the max just crossed the threshold. Checked for the 4-skill
    // pool and for each chosen skill's own 2-part pool.
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
    }

    return {
      sessionId: session.id,
      results: picks.map(({ skill, part }) => ({
        skill: { id: skill.id, code: skill.code, name: skill.name },
        part: { id: part.id, code: part.code, name: part.name },
      })),
    };
  });

  return NextResponse.json(payload);
}
