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
  questionTypes: many(questionTypes),
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
  // How many independent question-type draws a roll does for this part once it's
  // chosen (0 = skill/part has no question types, e.g. Speaking, Writing Task 2).
  // See PROJECT_CONTEXT.md section 5.7 — this mirrors the real number of
  // passages/parts bundled into the block (Reading Block A = Passage 1+2 -> 2).
  questionTypeRollCount: integer("question_type_roll_count").notNull().default(0),
});

export const skillPartsRelations = relations(skillParts, ({ one, many }) => ({
  skill: one(skills, { fields: [skillParts.skillId], references: [skills.id] }),
  rollResults: many(rollResults),
}));

// A skill's pool of question types (Matching Headings, True/False/Not Given, ...).
// Shared across that skill's parts/blocks (not tied to a specific block) — see
// PROJECT_CONTEXT.md section 5.7. Speaking has no rows here.
export const questionTypes = sqliteTable("question_types", {
  id: id(),
  skillId: text("skill_id")
    .notNull()
    .references(() => skills.id),
  code: text("code").notNull().unique(), // e.g. READING_MATCHING_HEADINGS
  name: text("name").notNull(),
  baseRatio: real("base_ratio").notNull().default(1.0),
  occurrenceCount: integer("occurrence_count").notNull().default(0),
  lastAppearedAt: integer("last_appeared_at", { mode: "timestamp" }),
});

export const questionTypesRelations = relations(questionTypes, ({ one, many }) => ({
  skill: one(skills, { fields: [questionTypes.skillId], references: [skills.id] }),
  rollResultQuestionTypes: many(rollResultQuestionTypes),
}));

export const rollSessions = sqliteTable("roll_sessions", {
  id: id(),
  rolledAt: integer("rolled_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  // 'roll' = came from the Spinner; 'manual' = user logged practice done without
  // rolling (see PROJECT_CONTEXT.md section 5.8). Both feed the same counters
  // and the same Formula 3 30-day frequency window.
  source: text("source").notNull().default("roll").$type<"roll" | "manual">(),
});

export const rollSessionsRelations = relations(rollSessions, ({ many }) => ({
  results: many(rollResults),
}));

// Exactly 2 rows per *rolled* rollSession (one per chosen skill); exactly 1 row
// for a *manual* rollSession (source = 'manual').
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

export const rollResultsRelations = relations(rollResults, ({ one, many }) => ({
  session: one(rollSessions, { fields: [rollResults.rollSessionId], references: [rollSessions.id] }),
  skill: one(skills, { fields: [rollResults.skillId], references: [skills.id] }),
  part: one(skillParts, { fields: [rollResults.skillPartId], references: [skillParts.id] }),
  questionTypes: many(rollResultQuestionTypes),
}));

// 0..N rows per rollResult — N = the part's questionTypeRollCount at roll time
// (0 or 1 for a manual entry, since the user picks at most one type by hand).
export const rollResultQuestionTypes = sqliteTable("roll_result_question_types", {
  id: id(),
  rollResultId: text("roll_result_id")
    .notNull()
    .references(() => rollResults.id),
  questionTypeId: text("question_type_id")
    .notNull()
    .references(() => questionTypes.id),
});

export const rollResultQuestionTypesRelations = relations(rollResultQuestionTypes, ({ one }) => ({
  rollResult: one(rollResults, { fields: [rollResultQuestionTypes.rollResultId], references: [rollResults.id] }),
  questionType: one(questionTypes, {
    fields: [rollResultQuestionTypes.questionTypeId],
    references: [questionTypes.id],
  }),
}));

// User-defined practice topics ("+" button in Settings). Deliberately minimal —
// just a name for now; not yet wired into the roll (see PROJECT_CONTEXT.md 5.9).
export const topics = sqliteTable("topics", {
  id: id(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

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
