import type { db as DefaultDb } from "./client";
import { skills, skillParts, questionTypes, config } from "./schema";

const SKILLS = [
  { code: "READING", name: "Reading" },
  { code: "LISTENING", name: "Listening" },
  { code: "WRITING", name: "Writing" },
  { code: "SPEAKING", name: "Speaking" },
] as const;

// questionTypeRollCount = how many passages/parts are bundled into that block,
// i.e. how many independent question-type draws a roll does once this part is
// chosen. See PROJECT_CONTEXT.md section 5.7.
const PARTS: Record<
  string,
  { code: string; name: string; baseRatio: number; questionTypeRollCount: number }[]
> = {
  READING: [
    { code: "READING_BLOCK_A", name: "Block A (Passage 1+2)", baseRatio: 0.6, questionTypeRollCount: 2 },
    { code: "READING_BLOCK_B", name: "Block B (Passage 3)", baseRatio: 0.4, questionTypeRollCount: 1 },
  ],
  LISTENING: [
    { code: "LISTENING_BLOCK_A", name: "Block A (Part 1+4)", baseRatio: 0.5, questionTypeRollCount: 2 },
    { code: "LISTENING_BLOCK_B", name: "Block B (Part 2+3)", baseRatio: 0.5, questionTypeRollCount: 2 },
  ],
  WRITING: [
    // Task 2 is always an essay — no chart "type" applies, so its roll count is 0.
    { code: "WRITING_TASK1", name: "Task 1", baseRatio: 0.5, questionTypeRollCount: 1 },
    { code: "WRITING_TASK2", name: "Task 2", baseRatio: 0.5, questionTypeRollCount: 0 },
  ],
  SPEAKING: [
    { code: "SPEAKING_BLOCK_A", name: "Block A (Part 1+2)", baseRatio: 0.6, questionTypeRollCount: 0 },
    { code: "SPEAKING_BLOCK_B", name: "Block B (Part 3)", baseRatio: 0.4, questionTypeRollCount: 0 },
  ],
};

// Question types per skill (PROJECT_CONTEXT.md section 5.7). Speaking has none.
// baseRatio only needs to be *relative* within its own skill's pool — Formula 1
// normalizes it, so these don't need to sum to 1 (same as skill/part baseRatio).
const QUESTION_TYPES: Record<string, { code: string; name: string; baseRatio: number }[]> = {
  READING: [
    { code: "READING_MATCHING_HEADINGS", name: "Matching Headings", baseRatio: 1.0 },
    { code: "READING_TRUE_FALSE_NOT_GIVEN", name: "True - False - Not Given", baseRatio: 1.0 },
    { code: "READING_YES_NO_NOT_GIVEN", name: "Yes - No - Not Given", baseRatio: 1.0 },
    { code: "READING_MC_ONE", name: "Multiple Choice (One Answer)", baseRatio: 1.0 },
    { code: "READING_MATCHING_INFORMATION", name: "Matching Information", baseRatio: 1.0 },
    { code: "READING_MATCHING_FEATURES", name: "Matching Features", baseRatio: 1.0 },
    { code: "READING_MC_MANY", name: "Multiple Choice (Many Answers)", baseRatio: 1.0 },
    { code: "READING_MAP_DIAGRAM_LABEL", name: "Map, Diagram Label", baseRatio: 1.0 },
    { code: "READING_GAP_FILLING", name: "Gap Filling", baseRatio: 1.0 },
    { code: "READING_OTHER", name: "Other Types", baseRatio: 1.0 },
  ],
  LISTENING: [
    { code: "LISTENING_GAP_FILLING", name: "Gap Filling", baseRatio: 1.0 },
    { code: "LISTENING_MAP_DIAGRAM_LABEL", name: "Map, Diagram Label", baseRatio: 1.0 },
    { code: "LISTENING_MC_ONE", name: "Multiple Choice (One Answer)", baseRatio: 1.0 },
    { code: "LISTENING_MATCHING_INFORMATION", name: "Matching Information", baseRatio: 1.0 },
    { code: "LISTENING_MC_MANY", name: "Multiple Choice (Many Answers)", baseRatio: 1.0 },
    { code: "LISTENING_MATCHING", name: "Matching", baseRatio: 1.0 },
    { code: "LISTENING_OTHER", name: "Other Types", baseRatio: 1.0 },
  ],
  WRITING: [
    // Higher baseRatio = drawn more often on average — Line/Bar/Pie/Table are
    // the most common Task 1 prompts in practice, Process/Map/Mixed rarer.
    { code: "WRITING_LINE_GRAPH", name: "Line Graph", baseRatio: 2.0 },
    { code: "WRITING_BAR_CHART", name: "Bar Chart", baseRatio: 2.0 },
    { code: "WRITING_PIE_CHART", name: "Pie Chart", baseRatio: 2.0 },
    { code: "WRITING_TABLE", name: "Table", baseRatio: 2.0 },
    { code: "WRITING_MIXED_GRAPH", name: "Mixed Graph", baseRatio: 1.0 },
    { code: "WRITING_MAP", name: "Map", baseRatio: 1.0 },
    { code: "WRITING_PROCESS", name: "Process", baseRatio: 1.0 },
  ],
  SPEAKING: [],
};

const CONFIG_DEFAULTS: { key: string; value: string }[] = [
  { key: "decay_exponent", value: "1.0" },
  { key: "weekly_threshold_days", value: "7" },
  { key: "frequency_adjustment_factor", value: "0.05" },
  { key: "overall_prediction_rounding_mode", value: "per_skill_rounded" }, // or "raw_average" — user-toggleable
  { key: "count_soft_reset_threshold", value: "50" },
  // Formula 3 v2 (PROJECT_CONTEXT.md 5.4): EWMA smoothing factor for the
  // Cambridge-score and practice-accuracy components — higher = more weight
  // on the newest data point, lower = slower to move away from history.
  // 0.5 means each new result is weighted equal to the *entire* prior
  // history combined — deliberately reactive, matching "quá khứ mờ dần,
  // hiện tại chủ yếu" (a single recent test can swing the prediction).
  { key: "cambridge_ewma_alpha", value: "0.5" },
  { key: "accuracy_ewma_alpha", value: "0.5" },
];

/**
 * Seeds the 4 skills / 8 parts / 6 Config defaults into whatever Drizzle
 * database instance is passed in. Exported (not just run as a CLI script) so
 * the Playwright e2e global setup can seed a separate, disposable test
 * database the same way `npm run db:seed` seeds the real one — see
 * seedCli.ts for the CLI entry point that seeds the real ./dev.db.
 */
export async function seedDatabase(database: typeof DefaultDb) {
  for (const skill of SKILLS) {
    const [inserted] = await database
      .insert(skills)
      .values(skill)
      .onConflictDoNothing({ target: skills.code })
      .returning();

    const skillRow =
      inserted ??
      (await database.query.skills.findFirst({ where: (s, { eq }) => eq(s.code, skill.code) }));

    if (!skillRow) throw new Error(`Failed to seed or find skill ${skill.code}`);

    for (const part of PARTS[skill.code]) {
      await database
        .insert(skillParts)
        .values({ ...part, skillId: skillRow.id })
        .onConflictDoNothing({ target: skillParts.code });
    }

    for (const type of QUESTION_TYPES[skill.code]) {
      await database
        .insert(questionTypes)
        .values({ ...type, skillId: skillRow.id })
        .onConflictDoNothing({ target: questionTypes.code });
    }
  }

  for (const entry of CONFIG_DEFAULTS) {
    await database.insert(config).values(entry).onConflictDoNothing({ target: config.key });
  }

  const questionTypeCount = Object.values(QUESTION_TYPES).reduce((sum, types) => sum + types.length, 0);

  return {
    skillCount: SKILLS.length,
    partCount: SKILLS.length * 2,
    questionTypeCount,
    configCount: CONFIG_DEFAULTS.length,
  };
}
