import { desc, eq, and, gte } from "drizzle-orm";
import { db } from "./client";
import { dailyNotes, cambridgeTestResults, rollResults, rollSessions, skills } from "./schema";
import { loadEngineConfig } from "./configHelpers";
import { predictAllSkillBands, type SkillPredictionInput } from "@/lib/engine/bandPrediction";

const CAMBRIDGE_SAMPLE_SIZE = 30;
const PRACTICE_WINDOW_DAYS = 30;

export function getSkillsWithParts() {
  return db.query.skills.findMany({ with: { parts: true } });
}

export function getAllNotes() {
  // Secondary sort by createdAt keeps same-day notes in a deterministic, newest-created-first
  // order across reloads (SQLite doesn't guarantee tie order on noteDate alone).
  return db.select().from(dailyNotes).orderBy(desc(dailyNotes.noteDate), desc(dailyNotes.createdAt));
}

export function getCambridgeResults(limit?: number) {
  const query = db.select().from(cambridgeTestResults).orderBy(desc(cambridgeTestResults.testDate));
  return limit !== undefined ? query.limit(limit) : query;
}

export function getRecentRollHistory(limit: number, offset = 0) {
  return db.query.rollSessions.findMany({
    orderBy: (session, { desc }) => [desc(session.rolledAt)],
    limit,
    offset,
    with: {
      results: { with: { skill: true, part: true } },
    },
  });
}

type CambridgeRow = typeof cambridgeTestResults.$inferSelect;

/**
 * Formula 3 (PROJECT_CONTEXT.md section 5.4), assembled from live DB reads.
 * Shared by GET /api/prediction and the /prediction Server Component so the
 * two never drift into computing this two different ways.
 */
export async function getPredictionData() {
  const engineConfig = loadEngineConfig(db);

  const recentTests = await db
    .select()
    .from(cambridgeTestResults)
    .orderBy(desc(cambridgeTestResults.testDate))
    .limit(CAMBRIDGE_SAMPLE_SIZE);

  const windowStart = new Date(Date.now() - PRACTICE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const allSkills = await db.select().from(skills);

  const practiceCounts = new Map<string, number>();
  for (const skill of allSkills) {
    const rows = await db
      .select({ id: rollResults.id })
      .from(rollResults)
      .innerJoin(rollSessions, eq(rollResults.rollSessionId, rollSessions.id))
      .where(and(eq(rollResults.skillId, skill.id), gte(rollSessions.rolledAt, windowStart)));
    practiceCounts.set(skill.code, rows.length);
  }

  const skillInput = (code: string, bandKey: keyof CambridgeRow): SkillPredictionInput => ({
    recentCambridgeBands: recentTests.map((t) => t[bandKey] as number),
    practiceCount30d: practiceCounts.get(code) ?? 0,
  });

  const prediction = predictAllSkillBands(
    {
      reading: skillInput("READING", "readingBand"),
      listening: skillInput("LISTENING", "listeningBand"),
      writing: skillInput("WRITING", "writingBand"),
      speaking: skillInput("SPEAKING", "speakingBand"),
    },
    {
      frequencyAdjustmentFactor: engineConfig.frequencyAdjustmentFactor,
      frequencyAdjustmentCap: engineConfig.frequencyAdjustmentCap,
      overallRoundingMode: engineConfig.overallRoundingMode,
    }
  );

  return {
    perSkill: {
      reading: prediction.reading,
      listening: prediction.listening,
      writing: prediction.writing,
      speaking: prediction.speaking,
    },
    overall: prediction.overallPredicted,
    sampleSizePerSkill: {
      reading: prediction.reading.sampleSize,
      listening: prediction.listening.sampleSize,
      writing: prediction.writing.sampleSize,
      speaking: prediction.speaking.sampleSize,
    },
    practiceCount30dPerSkill: {
      reading: practiceCounts.get("READING") ?? 0,
      listening: practiceCounts.get("LISTENING") ?? 0,
      writing: practiceCounts.get("WRITING") ?? 0,
      speaking: practiceCounts.get("SPEAKING") ?? 0,
    },
    hasEnoughData: prediction.overallPredicted !== null,
  };
}
