import { desc } from "drizzle-orm";
import { db } from "./client";
import { dailyNotes, cambridgeTestResults } from "./schema";

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
