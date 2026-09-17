import { db } from "./client";
import { skills, skillParts, config } from "./schema";

const SKILLS = [
  { code: "READING", name: "Reading" },
  { code: "LISTENING", name: "Listening" },
  { code: "WRITING", name: "Writing" },
  { code: "SPEAKING", name: "Speaking" },
] as const;

const PARTS: Record<string, { code: string; name: string; baseRatio: number }[]> = {
  READING: [
    { code: "READING_BLOCK_A", name: "Block A (Passage 1+2)", baseRatio: 0.6 },
    { code: "READING_BLOCK_B", name: "Block B (Passage 3)", baseRatio: 0.4 },
  ],
  LISTENING: [
    { code: "LISTENING_BLOCK_A", name: "Block A (Part 1+4)", baseRatio: 0.5 },
    { code: "LISTENING_BLOCK_B", name: "Block B (Part 2+3)", baseRatio: 0.5 },
  ],
  WRITING: [
    { code: "WRITING_TASK1", name: "Task 1", baseRatio: 0.5 },
    { code: "WRITING_TASK2", name: "Task 2", baseRatio: 0.5 },
  ],
  SPEAKING: [
    { code: "SPEAKING_BLOCK_A", name: "Block A (Part 1+2)", baseRatio: 0.6 },
    { code: "SPEAKING_BLOCK_B", name: "Block B (Part 3)", baseRatio: 0.4 },
  ],
};

const CONFIG_DEFAULTS: { key: string; value: string }[] = [
  { key: "decay_exponent", value: "1.0" },
  { key: "weekly_threshold_days", value: "7" },
  { key: "frequency_adjustment_factor", value: "0.05" },
  { key: "frequency_adjustment_cap", value: "0.5" },
  { key: "count_soft_reset_threshold", value: "50" },
];

async function seed() {
  for (const skill of SKILLS) {
    const [inserted] = await db
      .insert(skills)
      .values(skill)
      .onConflictDoNothing({ target: skills.code })
      .returning();

    const skillRow =
      inserted ??
      (await db.query.skills.findFirst({ where: (s, { eq }) => eq(s.code, skill.code) }));

    if (!skillRow) throw new Error(`Failed to seed or find skill ${skill.code}`);

    for (const part of PARTS[skill.code]) {
      await db
        .insert(skillParts)
        .values({ ...part, skillId: skillRow.id })
        .onConflictDoNothing({ target: skillParts.code });
    }
  }

  for (const entry of CONFIG_DEFAULTS) {
    await db.insert(config).values(entry).onConflictDoNothing({ target: config.key });
  }

  console.log("Seed complete: 4 skills, 8 parts, 5 config defaults.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
