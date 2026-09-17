import { relations } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const skills = sqliteTable("skills", {
  id: id(),
  code: text("code").notNull().unique(), // READING | LISTENING | WRITING | SPEAKING
  name: text("name").notNull(),
  occurrenceCount: integer("occurrence_count").notNull().default(0),
  lastAppearedAt: integer("last_appeared_at", { mode: "timestamp" }),
});

export const skillsRelations = relations(skills, ({ many }) => ({
  parts: many(skillParts),
  rollResults: many(rollResults),
}));

export const skillParts = sqliteTable("skill_parts", {
  id: id(),
  skillId: text("skill_id")
    .notNull()
    .references(() => skills.id),
  code: text("code").notNull().unique(), // e.g. WRITING_TASK1, SPEAKING_BLOCK_A
  name: text("name").notNull(), // e.g. "Task 1", "Block A (Part 1+2)"
  baseRatio: real("base_ratio").notNull().default(0.5),
  occurrenceCount: integer("occurrence_count").notNull().default(0),
  lastAppearedAt: integer("last_appeared_at", { mode: "timestamp" }),
});

export const skillPartsRelations = relations(skillParts, ({ one, many }) => ({
  skill: one(skills, { fields: [skillParts.skillId], references: [skills.id] }),
  rollResults: many(rollResults),
}));

export const rollSessions = sqliteTable("roll_sessions", {
  id: id(),
  rolledAt: integer("rolled_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const rollSessionsRelations = relations(rollSessions, ({ many }) => ({
  results: many(rollResults),
}));

// Exactly 2 rows per rollSession (one per chosen skill).
export const rollResults = sqliteTable("roll_results", {
  id: id(),
  rollSessionId: text("roll_session_id")
    .notNull()
    .references(() => rollSessions.id),
  skillId: text("skill_id")
    .notNull()
    .references(() => skills.id),
  skillPartId: text("skill_part_id")
    .notNull()
    .references(() => skillParts.id),
});

export const rollResultsRelations = relations(rollResults, ({ one }) => ({
  session: one(rollSessions, { fields: [rollResults.rollSessionId], references: [rollSessions.id] }),
  skill: one(skills, { fields: [rollResults.skillId], references: [skills.id] }),
  part: one(skillParts, { fields: [rollResults.skillPartId], references: [skillParts.id] }),
}));

export const cambridgeTestResults = sqliteTable("cambridge_test_results", {
  id: id(),
  testDate: integer("test_date", { mode: "timestamp" }).notNull(),
  testName: text("test_name").notNull(), // e.g. "Cambridge 18 - Test 2"
  readingBand: real("reading_band").notNull(),
  listeningBand: real("listening_band").notNull(),
  writingBand: real("writing_band").notNull(),
  speakingBand: real("speaking_band").notNull(),
  overallBand: real("overall_band").notNull(), // computed via ieltsRound() at write time
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const dailyNotes = sqliteTable("daily_notes", {
  id: id(),
  noteDate: integer("note_date", { mode: "timestamp" }).notNull(),
  tags: text("tags").notNull().default(""), // comma-separated, e.g. "Reading,Vocabulary"
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Key-value store for tunable engine parameters (decay_exponent, weekly_threshold_days, etc.)
export const config = sqliteTable("config", {
  id: id(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(), // stored as string, parsed to number/bool by the engine
});
