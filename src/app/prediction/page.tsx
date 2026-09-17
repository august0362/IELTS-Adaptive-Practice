import { getCambridgeResults } from "@/lib/db/queries";
import { CambridgeTracker } from "@/components/prediction/CambridgeTracker";
import type { CambridgeTestDTO } from "@/lib/types";

export default async function PredictionPage() {
  const recentResults = await getCambridgeResults(5);

  const initialResults: CambridgeTestDTO[] = recentResults.map((r) => ({
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dự đoán Band điểm</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Nhập điểm thi thử Cambridge để làm cơ sở dự đoán Band theo từng kỹ năng.
        </p>
      </div>

      <CambridgeTracker initialResults={initialResults} />
    </main>
  );
}
