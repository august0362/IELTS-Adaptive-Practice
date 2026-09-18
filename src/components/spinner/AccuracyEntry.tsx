"use client";

import { useState } from "react";

interface AccuracyEntryProps {
  resultId: string;
  onSaved?: () => void;
}

/**
 * Optional quick entry for "số câu đã làm / số câu đúng" after a Reading or
 * Listening practice session (PROJECT_CONTEXT.md 5.12) — feeds the
 * accuracyEwma component of Formula 3 v2 (5.4). Skipping it is fine; there's
 * no required interaction here besides typing numbers and pressing Lưu.
 */
export function AccuracyEntry({ resultId, onSaved }: AccuracyEntryProps) {
  const [answered, setAnswered] = useState("");
  const [correct, setCorrect] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (status === "saved") {
    return <p className="text-xs text-emerald-600">Đã lưu số câu đúng — tính vào dự đoán Band.</p>;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const questionsAnswered = Number(answered);
    const questionsCorrect = Number(correct);
    if (!Number.isInteger(questionsAnswered) || !Number.isInteger(questionsCorrect)) return;

    setStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/results/${resultId}/accuracy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionsAnswered, questionsCorrect }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      setStatus("saved");
      onSaved?.();
    } catch {
      setStatus("error");
      setErrorMessage("Lưu số câu đúng thất bại. Kiểm tra kết nối rồi thử lại.");
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2 text-xs">
      <span className="w-full text-foreground/50">Làm xong rồi? Ghi lại số câu đúng (tùy chọn):</span>
      <label className="flex flex-col gap-1 text-foreground/60">
        Số câu đã làm
        <input
          type="number"
          min={1}
          value={answered}
          onChange={(e) => setAnswered(e.target.value)}
          className="input-paper w-20 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-foreground/60">
        Số câu đúng
        <input
          type="number"
          min={0}
          value={correct}
          onChange={(e) => setCorrect(e.target.value)}
          className="input-paper w-20 px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={status === "saving" || !answered || !correct}
        className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "saving" ? "Đang lưu..." : "Lưu"}
      </button>
      {errorMessage && (
        <p role="alert" className="w-full text-red-600">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
