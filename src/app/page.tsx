import { db } from "@/lib/db/client";
import { getSkillsWithParts, getRecentRollHistory } from "@/lib/db/queries";
import { loadEngineConfig } from "@/lib/db/configHelpers";
import { Spinner } from "@/components/spinner/Spinner";
import type { HistorySession } from "@/lib/types";

export default async function Home() {
  const [skillRows, config, historySessions] = await Promise.all([
    getSkillsWithParts(),
    Promise.resolve(loadEngineConfig(db)),
    getRecentRollHistory(5),
  ]);

  // Convert Date -> ISO string so the shape matches what GET /api/skills returns over JSON
  // (the client component's SkillDTO type expects string | null, not a Date object).
  const skills = skillRows.map((skill) => ({
    ...skill,
    lastAppearedAt: skill.lastAppearedAt?.toISOString() ?? null,
    parts: skill.parts.map((part) => ({
      ...part,
      lastAppearedAt: part.lastAppearedAt?.toISOString() ?? null,
    })),
  }));

  const initialRecentRolls: HistorySession[] = historySessions.map((session) => ({
    id: session.id,
    rolledAt: session.rolledAt.toISOString(),
    results: session.results.map((r) => ({
      skill: { id: r.skill.id, code: r.skill.code, name: r.skill.name },
      part: { id: r.part.id, code: r.part.code, name: r.part.name },
    })),
  }));

  return (
    <Spinner
      initialSkills={skills}
      initialDecayExponent={config.decayExponent}
      initialRecentRolls={initialRecentRolls}
    />
  );
}
