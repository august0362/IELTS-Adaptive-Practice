"use client";

import { useState } from "react";
import type { PracticeResponse, SkillDTO } from "@/lib/types";
import { AccuracyEntry } from "./AccuracyEntry";

const ACCURACY_SKILL_CODES = new Set(["READING", "LISTENING"]);

interface ManualPracticeProps {
  skills: SkillDTO[];
  onLogged: () => void;
}

/**
 * Lets the user log practice done without the Spinner (PROJECT_CONTEXT.md
 * section 5.8) — for whenever they study a skill on their own initiative.
 * Picks Skill -> Part -> Question type (only when the part actually has any)
 * and POSTs to /api/practice, which counts identically to a real roll.
 */
export function ManualPractice({ skills, onLogged }: ManualPracticeProps) {
  const [skillCode, setSkillCode] = useState(skills[0]?.code ?? "");
  const [partCode, setPartCode] = useState(skills[0]?.parts[0]?.code ?? "");
  const [questionTypeCode, setQuestionTypeCode] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [loggedResult, setLoggedResult] = useState<{ resultId: string; skillCode: string } | null>(null);

  const selectedSkill = skills.find((s) => s.code === skillCode);
  const selectedPart = selectedSkill?.parts.find((p) => p.code === partCode);
  const needsType = (selectedPart?.questionTypeRollCount ?? 0) > 0;

  function handleSkillChange(nextSkillCode: string) {
    setSkillCode(nextSkillCode);
    const nextSkill = skills.find((s) => s.code === nextSkillCode);
    setPartCode(nextSkill?.parts[0]?.code ?? "");
    setQuestionTypeCode("");
  }

  function handlePartChange(nextPartCode: string) {
    setPartCode(nextPartCode);
    setQuestionTypeCode("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSkill || !selectedPart) return;

    setStatus("saving");
    setErrorMessage(null);
    setConfirmation(null);
    setLoggedResult(null);
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillCode,
          partCode,
          questionTypeCode: needsType && questionTypeCode ? questionTypeCode : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const data = (await res.json()) as PracticeResponse;
      setStatus("idle");
      setConfirmation(
        `Đã ghi nhận: ${data.skill.name} · ${data.part.name}${data.questionType ? ` (${data.questionType.name})` : ""}`
      );
      setLoggedResult(
        ACCURACY_SKILL_CODES.has(data.skill.code) ? { resultId: data.resultId, skillCode: data.skill.code } : null
      );
      onLogged();
    } catch {
      setStatus("error");
      setErrorMessage("Ghi nhận thất bại. Kiểm tra kết nối rồi thử lại.");
    }
  }

  return (
    <section className="surface-glow flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-medium text-surface-foreground/70">Tự học (không qua vòng quay)</h2>
        <p className="mt-0.5 text-xs text-surface-foreground/50">
          Đã tự luyện 1 kỹ năng mà không quay? Ghi lại ở đây để vẫn tính vào thống kê và dự đoán.
        </p>
      </div>

      {errorMessage && (
        <p role="alert" className="text-xs text-red-600">
          {errorMessage}
        </p>
      )}
      {confirmation && <p className="text-xs text-emerald-600">{confirmation}</p>}
      {loggedResult && <AccuracyEntry resultId={loggedResult.resultId} variant="surface" />}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs text-surface-foreground/60">
          Kỹ năng
          <select
            value={skillCode}
            onChange={(e) => handleSkillChange(e.target.value)}
            className="input-paper px-2 py-1.5 text-sm"
          >
            {skills.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-xs text-surface-foreground/60">
          Part
          <select
            value={partCode}
            onChange={(e) => handlePartChange(e.target.value)}
            className="input-paper px-2 py-1.5 text-sm"
          >
            {selectedSkill?.parts.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {needsType && (
          <label className="flex flex-1 flex-col gap-1 text-xs text-surface-foreground/60">
            Dạng bài (tùy chọn)
            <select
              value={questionTypeCode}
              onChange={(e) => setQuestionTypeCode(e.target.value)}
              className="input-paper px-2 py-1.5 text-sm"
            >
              <option value="">— Không rõ —</option>
              {selectedSkill?.questionTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="submit"
          disabled={status === "saving" || !skillCode || !partCode}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "saving" ? "Đang ghi..." : "Ghi nhận"}
        </button>
      </form>
    </section>
  );
}
