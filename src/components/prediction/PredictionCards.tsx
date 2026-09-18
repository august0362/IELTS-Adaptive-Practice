import Link from "next/link";
import type { PredictionResponseDTO, SkillPredictionResultDTO } from "@/lib/types";

const SKILL_LABELS: { key: keyof PredictionResponseDTO["perSkill"]; name: string; code: string }[] = [
  { key: "reading", name: "Reading", code: "READING" },
  { key: "listening", name: "Listening", code: "LISTENING" },
  { key: "writing", name: "Writing", code: "WRITING" },
  { key: "speaking", name: "Speaking", code: "SPEAKING" },
];

function SkillCard({ name, code, result }: { name: string; code: string; result: SkillPredictionResultDTO }) {
  return (
    <Link
      href={`/stats/${code}`}
      aria-label={`Xem thống kê ${name}`}
      className="surface-glow flex flex-col items-center gap-1 rounded-xl border border-border bg-surface p-4 text-center transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="text-xs font-medium text-surface-foreground/60">{name}</span>
      {result.predictedBand === null ? (
        <span className="text-sm text-surface-foreground/40">Chưa đủ dữ liệu</span>
      ) : (
        <>
          <span className="text-2xl font-semibold text-surface-foreground">{result.predictedBand}</span>
          <span className="text-xs text-surface-foreground/50">{result.sampleSize} bài thi thử</span>
          {result.cambridgeEwma !== null && (
            <span className="text-[11px] text-surface-foreground/40">
              Cambridge {result.cambridgeEwma.toFixed(1)}
              {result.accuracyEwma !== null ? ` · Luyện tập ${result.accuracyEwma.toFixed(1)}` : ""}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export function PredictionCards({ prediction }: { prediction: PredictionResponseDTO }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">Band điểm dự đoán</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SKILL_LABELS.map(({ key, name, code }) => (
          <SkillCard key={key} name={name} code={code} result={prediction.perSkill[key]} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-primary bg-primary/10 p-4 text-center">
        <span className="text-xs font-medium text-primary">Overall dự đoán</span>
        {prediction.overall === null ? (
          <span className="text-sm text-foreground/50">Cần đủ dữ liệu cả 4 kỹ năng</span>
        ) : (
          <span className="text-3xl font-semibold text-foreground">{prediction.overall}</span>
        )}
      </div>
    </section>
  );
}
