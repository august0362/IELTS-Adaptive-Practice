"use client";

import { useState } from "react";
import type { CambridgeTestDTO, PredictionResponseDTO, SkillDTO } from "@/lib/types";
import { PredictionCards } from "./PredictionCards";
import { RoundingModeToggle } from "./RoundingModeToggle";
import { RatioSliders } from "./RatioSliders";
import { FrequencyChart } from "./FrequencyChart";
import { CambridgeTracker } from "./CambridgeTracker";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

interface PredictionPageClientProps {
  initialPrediction: PredictionResponseDTO;
  initialCambridgeResults: CambridgeTestDTO[];
  initialSkills: SkillDTO[];
  initialRoundingMode: string;
}

export function PredictionPageClient({
  initialPrediction,
  initialCambridgeResults,
  initialSkills,
  initialRoundingMode,
}: PredictionPageClientProps) {
  const [prediction, setPrediction] = useState(initialPrediction);
  const [roundingMode, setRoundingMode] = useState(initialRoundingMode);
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshPrediction() {
    try {
      const data = await fetchJson<PredictionResponseDTO>("/api/prediction");
      setPrediction(data);
    } catch {
      setErrorMessage("Không tải được dự đoán mới nhất.");
    }
  }

  async function handleRoundingModeChange(mode: "per_skill_rounded" | "raw_average") {
    setIsSavingMode(true);
    setErrorMessage(null);
    try {
      await fetchJson("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "overall_prediction_rounding_mode", value: mode }),
      });
      setRoundingMode(mode);
      await refreshPrediction();
    } catch {
      setErrorMessage("Đổi cách tính thất bại. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setIsSavingMode(false);
    }
  }

  const frequencyData = [
    { name: "Reading", count: prediction.practiceCount30dPerSkill.reading },
    { name: "Listening", count: prediction.practiceCount30dPerSkill.listening },
    { name: "Writing", count: prediction.practiceCount30dPerSkill.writing },
    { name: "Speaking", count: prediction.practiceCount30dPerSkill.speaking },
  ];

  return (
    <div className="flex flex-col gap-8">
      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}

      <PredictionCards prediction={prediction} />
      <RoundingModeToggle mode={roundingMode} onChange={handleRoundingModeChange} isSaving={isSavingMode} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground/70">Tần suất luyện tập (30 ngày gần đây)</h2>
        <FrequencyChart data={frequencyData} />
      </section>

      <RatioSliders skills={initialSkills} />

      <CambridgeTracker initialResults={initialCambridgeResults} onChanged={refreshPrediction} />
    </div>
  );
}
