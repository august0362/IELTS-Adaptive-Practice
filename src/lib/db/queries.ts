import { desc } from "drizzle-orm";
import { db } from "./client";
import { dailyNotes } from "./schema";

export function getSkillsWithParts() {
  return db.query.skills.findMany({ with: { parts: true } });
}

export function getAllNotes() {
  return db.select().from(dailyNotes).orderBy(desc(dailyNotes.noteDate));
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
