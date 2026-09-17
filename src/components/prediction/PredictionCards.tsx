import type { PredictionResponseDTO, SkillPredictionResultDTO } from "@/lib/types";

const SKILL_LABELS: { key: keyof PredictionResponseDTO["perSkill"]; name: string }[] = [
  { key: "reading", name: "Reading" },
  { key: "listening", name: "Listening" },
  { key: "writing", name: "Writing" },
  { key: "speaking", name: "Speaking" },
];

function SkillCard({ name, result }: { name: string; result: SkillPredictionResultDTO }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-black/10 bg-white/60 p-4 text-center dark:border-white/10 dark:bg-white/5">
      <span className="text-xs font-medium text-foreground/60">{name}</span>
      {result.predictedBand === null ? (
        <span className="text-sm text-foreground/40">Chưa đủ dữ liệu</span>
      ) : (
        <>
          <span className="text-2xl font-semibold text-foreground">{result.predictedBand}</span>
          <span className="text-xs text-foreground/50">{result.sampleSize} bài thi thử</span>
        </>
      )}
    </div>
  );
}

export function PredictionCards({ prediction }: { prediction: PredictionResponseDTO }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">Band điểm dự đoán</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SKILL_LABELS.map(({ key, name }) => (
          <SkillCard key={key} name={name} result={prediction.perSkill[key]} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-center dark:border-emerald-500 dark:bg-emerald-950">
        <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Overall dự đoán</span>
        {prediction.overall === null ? (
          <span className="text-sm text-emerald-800/60 dark:text-emerald-200/60">
            Cần đủ dữ liệu cả 4 kỹ năng
          </span>
        ) : (
          <span className="text-3xl font-semibold text-emerald-900 dark:text-emerald-100">{prediction.overall}</span>
        )}
      </div>
    </section>
  );
}
