import { desc } from "drizzle-orm";
import { db } from "./client";
import { dailyNotes } from "./schema";

export function getSkillsWithParts() {
  return db.query.skills.findMany({ with: { parts: true } });
}

export function getAllNotes() {
  // Secondary sort by createdAt keeps same-day notes in a deterministic, newest-created-first
  // order across reloads (SQLite doesn't guarantee tie order on noteDate alone).
  return db.select().from(dailyNotes).orderBy(desc(dailyNotes.noteDate), desc(dailyNotes.createdAt));
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
