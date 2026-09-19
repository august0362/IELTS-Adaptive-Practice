import { desc, eq, and, gte, isNotNull } from "drizzle-orm";
import { db } from "./client";
import {
  dailyNotes,
  cambridgeTestResults,
  rollResults,
  rollSessions,
  skills,
  skillParts,
  questionTypes,
  rollResultQuestionTypes,
  topics,
} from "./schema";
import { loadEngineConfig } from "./configHelpers";
import { predictAllSkillBands, type SkillPredictionInput } from "@/lib/engine/bandPrediction";

const CAMBRIDGE_SAMPLE_SIZE = 30;
const ACCURACY_SAMPLE_SIZE = 30;
const PRACTICE_WINDOW_DAYS = 30;
const ACCURACY_SKILL_CODES = new Set(["READING", "LISTENING"]);

export function getAllTopics() {
  return db.select().from(topics).orderBy(desc(topics.createdAt));
}

export function getSkillsWithParts() {
  return db.query.skills.findMany({ with: { parts: true, questionTypes: true } });
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
      results: { with: { skill: true, part: true, questionTypes: { with: { questionType: true } } } },
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

  // Chronological (oldest first) — EWMA folds forward from the oldest point,
  // so the DB's newest-first order has to be reversed before feeding it in.
  const recentTestsChronological = (
    await db.select().from(cambridgeTestResults).orderBy(desc(cambridgeTestResults.testDate)).limit(CAMBRIDGE_SAMPLE_SIZE)
  ).reverse();

  const windowStart = new Date(Date.now() - PRACTICE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const allSkills = await db.select().from(skills);

  const practiceCounts = new Map<string, number>();
  const accuracyPercentagesBySkill = new Map<string, number[]>();
  for (const skill of allSkills) {
    const rows = await db
      .select({ id: rollResults.id })
      .from(rollResults)
      .innerJoin(rollSessions, eq(rollResults.rollSessionId, rollSessions.id))
      .where(and(eq(rollResults.skillId, skill.id), gte(rollSessions.rolledAt, windowStart)));
    practiceCounts.set(skill.code, rows.length);

    if (ACCURACY_SKILL_CODES.has(skill.code)) {
      const accuracyRows = await db
        .select({ questionsAnswered: rollResults.questionsAnswered, questionsCorrect: rollResults.questionsCorrect })
        .from(rollResults)
        .innerJoin(rollSessions, eq(rollResults.rollSessionId, rollSessions.id))
        .where(
          and(
            eq(rollResults.skillId, skill.id),
            isNotNull(rollResults.questionsAnswered),
            isNotNull(rollResults.questionsCorrect)
          )
        )
        .orderBy(desc(rollSessions.rolledAt))
        .limit(ACCURACY_SAMPLE_SIZE);
      accuracyPercentagesBySkill.set(
        skill.code,
        accuracyRows.reverse().map((r) => (r.questionsCorrect! / r.questionsAnswered!) * 100)
      );
    }
  }

  const skillInput = (code: string, bandKey: keyof CambridgeRow): SkillPredictionInput => ({
    cambridgeBandsChronological: recentTestsChronological.map((t) => t[bandKey] as number),
    hasAccuracyComponent: ACCURACY_SKILL_CODES.has(code),
    accuracyPercentagesChronological: accuracyPercentagesBySkill.get(code) ?? [],
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
      cambridgeEwmaAlpha: engineConfig.cambridgeEwmaAlpha,
      accuracyEwmaAlpha: engineConfig.accuracyEwmaAlpha,
      frequencyAdjustmentFactor: engineConfig.frequencyAdjustmentFactor,
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

const CHAT_NOTES_SAMPLE_SIZE = 5;
const CHAT_ROLLS_SAMPLE_SIZE = 10;
const CHAT_CAMBRIDGE_SAMPLE_SIZE = 5;
const CHAT_NOTE_SNIPPET_LENGTH = 120;

/**
 * Plain-text digest of the user's own recent data (practice history, Cambridge
 * scores, journal notes) — passed as `dbContext` to the chatbot's inference
 * server (ai/server/) so it can give advice like "luyện gì tuần này" without
 * ai/ ever reading web/'s DB directly (see PROJECT_CONTEXT.md section 11.1 —
 * the two modules only talk over HTTP). Deliberately not the full history:
 * kept to a handful of recent rows so it stays a small, cheap addition to the
 * prompt rather than a second RAG corpus.
 */
export async function getChatContextSummary(): Promise<string> {
  const [notes, recentSessions, cambridgeResults] = await Promise.all([
    db.select().from(dailyNotes).orderBy(desc(dailyNotes.noteDate), desc(dailyNotes.createdAt)).limit(CHAT_NOTES_SAMPLE_SIZE),
    getRecentRollHistory(CHAT_ROLLS_SAMPLE_SIZE),
    getCambridgeResults(CHAT_CAMBRIDGE_SAMPLE_SIZE),
  ]);

  const lines: string[] = [];

  if (recentSessions.length > 0) {
    lines.push("Lịch sử luyện tập gần đây (mới nhất trước):");
    for (const session of recentSessions) {
      const date = session.rolledAt.toISOString().slice(0, 10);
      const parts = session.results.map((r) => `${r.skill.name} (${r.part.name})`).join(", ") || "(không có kết quả)";
      lines.push(`- ${date} [${session.source === "roll" ? "quay" : "tự học"}]: ${parts}`);
    }
  } else {
    lines.push("Chưa có lịch sử luyện tập nào.");
  }

  if (cambridgeResults.length > 0) {
    lines.push("", "Điểm thi thử Cambridge gần đây:");
    for (const r of cambridgeResults) {
      const date = r.testDate.toISOString().slice(0, 10);
      lines.push(
        `- ${date} ${r.testName}: Reading ${r.readingBand}, Listening ${r.listeningBand}, Writing ${r.writingBand}, Speaking ${r.speakingBand} (Overall ${r.overallBand})`
      );
    }
  }

  if (notes.length > 0) {
    lines.push("", "Ghi chú nhật ký gần đây:");
    for (const n of notes) {
      const date = n.noteDate.toISOString().slice(0, 10);
      const snippet = n.content.length > CHAT_NOTE_SNIPPET_LENGTH ? n.content.slice(0, CHAT_NOTE_SNIPPET_LENGTH) + "…" : n.content;
      lines.push(`- ${date}${n.tags ? ` [${n.tags}]` : ""}: ${snippet}`);
    }
  }

  return lines.join("\n");
}

/**
 * Shared by GET /api/stats/:skillCode and the /stats/[skillCode] Server
 * Component (PROJECT_CONTEXT.md section 5.10), same reasoning as
 * getPredictionData above — one place computing this so the two never drift.
 * Returns null when skillCode doesn't match a seeded skill.
 */
export async function getSkillStats(skillCode: string) {
  const [skill] = await db.select().from(skills).where(eq(skills.code, skillCode));
  if (!skill) return null;

  const practiceRows = await db
    .select({
      rolledAt: rollSessions.rolledAt,
      source: rollSessions.source,
      partCode: skillParts.code,
      partName: skillParts.name,
      questionsAnswered: rollResults.questionsAnswered,
      questionsCorrect: rollResults.questionsCorrect,
    })
    .from(rollResults)
    .innerJoin(rollSessions, eq(rollResults.rollSessionId, rollSessions.id))
    .innerJoin(skillParts, eq(rollResults.skillPartId, skillParts.id))
    .where(eq(rollResults.skillId, skill.id))
    .orderBy(desc(rollSessions.rolledAt));

  const practiceLog = practiceRows.map((row) => ({
    rolledAt: row.rolledAt,
    source: row.source,
    part: { code: row.partCode, name: row.partName },
    questionsAnswered: row.questionsAnswered,
    questionsCorrect: row.questionsCorrect,
  }));

  const types = await db.select().from(questionTypes).where(eq(questionTypes.skillId, skill.id));

  let questionTypeStats: { code: string; name: string; count: number; percentage: number }[] | null = null;
  if (types.length > 0) {
    const counted = await Promise.all(
      types.map(async (type) => {
        const rows = await db
          .select({ id: rollResultQuestionTypes.id })
          .from(rollResultQuestionTypes)
          .where(eq(rollResultQuestionTypes.questionTypeId, type.id));
        return { type, count: rows.length };
      })
    );
    const total = counted.reduce((sum, c) => sum + c.count, 0);
    questionTypeStats = counted.map(({ type, count }) => ({
      code: type.code,
      name: type.name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));
  }

  return {
    skill: { id: skill.id, code: skill.code, name: skill.name },
    practiceLog,
    questionTypeStats,
  };
}
