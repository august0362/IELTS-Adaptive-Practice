import { NextResponse } from "next/server";
import { desc, gte, eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cambridgeTestResults, rollResults, rollSessions, skills } from "@/lib/db/schema";
import { loadEngineConfig } from "@/lib/db/configHelpers";
import { predictAllSkillBands, type SkillPredictionInput } from "@/lib/engine/bandPrediction";

const CAMBRIDGE_SAMPLE_SIZE = 30;
const PRACTICE_WINDOW_DAYS = 30;

type CambridgeRow = typeof cambridgeTestResults.$inferSelect;

export async function GET() {
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

  return NextResponse.json({
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
    hasEnoughData: prediction.overallPredicted !== null,
  });
}
