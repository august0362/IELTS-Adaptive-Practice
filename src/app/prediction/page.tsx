import { getCambridgeResults, getPredictionData, getSkillsWithParts } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { loadEngineConfig } from "@/lib/db/configHelpers";
import { PredictionPageClient } from "@/components/prediction/PredictionPageClient";
import type { CambridgeTestDTO, SkillDTO } from "@/lib/types";

// Live DB read on every request — see page.tsx's identical comment.
export const dynamic = "force-dynamic";

export default async function PredictionPage() {
  const [recentResults, prediction, skillRows, engineConfig] = await Promise.all([
    getCambridgeResults(5),
    getPredictionData(),
    getSkillsWithParts(),
    Promise.resolve(loadEngineConfig(db)),
  ]);

  const initialCambridgeResults: CambridgeTestDTO[] = recentResults.map((r) => ({
    id: r.id,
    testDate: r.testDate.toISOString(),
    testName: r.testName,
    readingBand: r.readingBand,
    listeningBand: r.listeningBand,
    writingBand: r.writingBand,
    speakingBand: r.speakingBand,
    overallBand: r.overallBand,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));

  const initialSkills: SkillDTO[] = skillRows.map((skill) => ({
    ...skill,
    lastAppearedAt: skill.lastAppearedAt?.toISOString() ?? null,
    parts: skill.parts.map((part) => ({
      ...part,
      lastAppearedAt: part.lastAppearedAt?.toISOString() ?? null,
    })),
    questionTypes: skill.questionTypes.map((type) => ({
      ...type,
      lastAppearedAt: type.lastAppearedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dự đoán Band điểm</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Nhập điểm thi thử Cambridge để làm cơ sở dự đoán Band theo từng kỹ năng.
        </p>
      </div>

      <PredictionPageClient
        initialPrediction={prediction}
        initialCambridgeResults={initialCambridgeResults}
        initialSkills={initialSkills}
        initialRoundingMode={engineConfig.overallRoundingMode}
      />
    </main>
  );
}
