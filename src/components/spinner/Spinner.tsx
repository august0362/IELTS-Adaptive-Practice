"use client";

import { useState } from "react";
import Link from "next/link";
import { computeProbabilities } from "@/lib/engine/weightedRandom";
import { runCycleAnimation, sleep } from "@/lib/spinnerAnimation";
import type { HistorySession, RollResultItem, SkillDTO } from "@/lib/types";
import { PickCard, type PickCardState } from "./PickCard";
import { RecentRolls } from "./RecentRolls";
import { ManualPractice } from "./ManualPractice";

type Phase = "idle" | "rolling" | "done" | "error";

interface SpinnerProps {
  initialSkills: SkillDTO[];
  initialDecayExponent: number;
  initialRecentRolls: HistorySession[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export function Spinner({ initialSkills, initialDecayExponent, initialRecentRolls }: SpinnerProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [skills, setSkills] = useState<SkillDTO[]>(initialSkills);
  const [recentRolls, setRecentRolls] = useState<HistorySession[]>(initialRecentRolls);

  const [skillStates, setSkillStates] = useState<Record<string, PickCardState>>(
    Object.fromEntries(initialSkills.map((s) => [s.id, "idle" as PickCardState]))
  );
  const [orderedSelectedSkillIds, setOrderedSelectedSkillIds] = useState<string[]>([]);
  const [partStatesBySkillId, setPartStatesBySkillId] = useState<Record<string, Record<string, PickCardState>>>({});
  // One state-map per question-type draw for that skill (e.g. Reading Block A
  // draws 2 independent types — one per passage — see PROJECT_CONTEXT.md 5.7).
  const [typeDrawStatesBySkillId, setTypeDrawStatesBySkillId] = useState<
    Record<string, Record<string, PickCardState>[]>
  >({});
  const [chosenTypeNamesBySkillId, setChosenTypeNamesBySkillId] = useState<Record<string, string[]>>({});

  const skillProbabilities = computeProbabilities(
    skills.map((s) => ({ id: s.id, occurrenceCount: s.occurrenceCount })),
    initialDecayExponent
  );

  function partProbabilitiesFor(skill: SkillDTO): Map<string, number> {
    return computeProbabilities(
      skill.parts.map((p) => ({ id: p.id, occurrenceCount: p.occurrenceCount, baseRatio: p.baseRatio })),
      initialDecayExponent
    );
  }

  function typeProbabilitiesFor(skill: SkillDTO): Map<string, number> {
    return computeProbabilities(
      skill.questionTypes.map((t) => ({ id: t.id, occurrenceCount: t.occurrenceCount, baseRatio: t.baseRatio })),
      initialDecayExponent
    );
  }

  // Screen-reader-only announcement of the final result, for aria-live below —
  // sighted users already see it via the card states, but nothing was
  // otherwise announced to assistive tech when a roll finishes.
  const resultAnnouncement =
    phase === "done"
      ? orderedSelectedSkillIds
          .map((skillId) => {
            const skill = skills.find((s) => s.id === skillId);
            if (!skill) return null;
            const selectedPartId = Object.entries(partStatesBySkillId[skillId] ?? {}).find(
              ([, state]) => state === "selected"
            )?.[0];
            const part = skill.parts.find((p) => p.id === selectedPartId);
            const typeNames = chosenTypeNamesBySkillId[skillId];
            const typesSuffix = typeNames && typeNames.length > 0 ? ` (${typeNames.join(", ")})` : "";
            return part ? `${skill.name}: ${part.name}${typesSuffix}` : skill.name;
          })
          .filter((entry): entry is string => entry !== null)
          .join(", ")
      : "";

  async function runRollSequence(results: RollResultItem[], allSkills: SkillDTO[]) {
    let candidateSkills = allSkills;

    for (const result of results) {
      const landIndex = candidateSkills.findIndex((s) => s.code === result.skill.code);
      if (landIndex === -1) continue; // defensive: server result must match a known skill

      await runCycleAnimation(candidateSkills.length, landIndex, (i) => {
        setSkillStates((prev) => {
          const next = { ...prev };
          candidateSkills.forEach((s, idx) => {
            if (prev[s.id] !== "selected") next[s.id] = idx === i ? "cycling" : "idle";
          });
          return next;
        });
      });

      const chosenSkill = candidateSkills[landIndex];
      setSkillStates((prev) => ({ ...prev, [chosenSkill.id]: "selected" }));
      setOrderedSelectedSkillIds((prev) => [...prev, chosenSkill.id]);
      setPartStatesBySkillId((prev) => ({
        ...prev,
        [chosenSkill.id]: Object.fromEntries(chosenSkill.parts.map((p) => [p.id, "idle" as PickCardState])),
      }));

      await sleep(300);

      const partLandIndex = chosenSkill.parts.findIndex((p) => p.code === result.part.code);
      await runCycleAnimation(chosenSkill.parts.length, partLandIndex, (i) => {
        setPartStatesBySkillId((prev) => ({
          ...prev,
          [chosenSkill.id]: Object.fromEntries(
            chosenSkill.parts.map((p, idx) => [p.id, idx === i ? "cycling" : "idle"])
          ),
        }));
      });

      const chosenPart = chosenSkill.parts[partLandIndex];
      setPartStatesBySkillId((prev) => ({
        ...prev,
        [chosenSkill.id]: Object.fromEntries(
          chosenSkill.parts.map((p) => [p.id, p.id === chosenPart.id ? "selected" : "dimmed"])
        ),
      }));

      await sleep(400);

      // Question-type sub-draws (PROJECT_CONTEXT.md 5.7) — 0..2 independent
      // cascades over the skill's own type pool, one per result.questionTypes entry.
      const typePool = chosenSkill.questionTypes;
      const drawStates: Record<string, PickCardState>[] = [];
      setTypeDrawStatesBySkillId((prev) => ({ ...prev, [chosenSkill.id]: [] }));

      for (const chosenType of result.questionTypes) {
        const typeLandIndex = typePool.findIndex((t) => t.code === chosenType.code);
        if (typeLandIndex === -1) continue; // defensive: server result must match a known type

        const drawIndex = drawStates.length;
        drawStates.push(Object.fromEntries(typePool.map((t) => [t.id, "idle" as PickCardState])));

        await runCycleAnimation(typePool.length, typeLandIndex, (i) => {
          drawStates[drawIndex] = Object.fromEntries(
            typePool.map((t, idx) => [t.id, idx === i ? "cycling" : "idle"])
          );
          setTypeDrawStatesBySkillId((prev) => ({ ...prev, [chosenSkill.id]: [...drawStates] }));
        });

        drawStates[drawIndex] = Object.fromEntries(
          typePool.map((t, idx) => [t.id, idx === typeLandIndex ? "selected" : "dimmed"])
        );
        setTypeDrawStatesBySkillId((prev) => ({ ...prev, [chosenSkill.id]: [...drawStates] }));
        setChosenTypeNamesBySkillId((prev) => ({
          ...prev,
          [chosenSkill.id]: [...(prev[chosenSkill.id] ?? []), typePool[typeLandIndex].name],
        }));

        await sleep(300);
      }

      candidateSkills = candidateSkills.filter((s) => s.id !== chosenSkill.id);
      await sleep(400);
    }

    setSkillStates((prev) => {
      const next = { ...prev };
      for (const s of allSkills) if (next[s.id] !== "selected") next[s.id] = "dimmed";
      return next;
    });
  }

  async function refreshSkillsAndHistory(): Promise<boolean> {
    try {
      const [freshSkills, freshHistory] = await Promise.all([
        fetchJson<SkillDTO[]>("/api/skills"),
        fetchJson<{ items: HistorySession[] }>("/api/history?limit=5"),
      ]);
      setSkills(freshSkills);
      setRecentRolls(freshHistory.items);
      return true;
    } catch {
      return false;
    }
  }

  async function handleRoll() {
    setPhase("rolling");
    setErrorMessage(null);
    setOrderedSelectedSkillIds([]);
    setPartStatesBySkillId({});
    setTypeDrawStatesBySkillId({});
    setChosenTypeNamesBySkillId({});
    setSkillStates(Object.fromEntries(skills.map((s) => [s.id, "idle" as PickCardState])));

    try {
      const rollResponse = await fetchJson<{ sessionId: string; results: RollResultItem[] }>("/api/roll", {
        method: "POST",
      });
      await runRollSequence(rollResponse.results, skills);
      setPhase("done");
    } catch {
      setErrorMessage("Quay thất bại. Kiểm tra kết nối rồi thử lại.");
      setPhase("error");
      return;
    }

    // The roll itself already succeeded server-side and the animation above
    // finished showing it — a failure here is only a stale-data refresh
    // problem, not a failed roll, so it must not overwrite `phase`/the error
    // message with the "roll failed" state above.
    const refreshed = await refreshSkillsAndHistory();
    if (!refreshed) {
      setErrorMessage(
        "Quay thành công nhưng không tải được số liệu mới nhất. Số liệu sẽ cập nhật ở lần quay hoặc tải trang tiếp theo."
      );
    }
  }

  async function handleHistoryDeleted() {
    await refreshSkillsAndHistory();
  }

  async function handlePracticeLogged() {
    await refreshSkillsAndHistory();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vòng quay kỹ năng</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Quay để chọn ngẫu nhiên 2/4 kỹ năng, ưu tiên kỹ năng lâu chưa luyện.
        </p>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}

      <div aria-live="polite" role="status" className="sr-only">
        {phase === "rolling" ? "Đang quay..." : resultAnnouncement ? `Kết quả: ${resultAnnouncement}` : ""}
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {skills.map((skill) => (
          <Link
            key={skill.id}
            href={`/stats/${skill.code}`}
            aria-label={`Xem thống kê ${skill.name}`}
            className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <PickCard
              name={skill.name}
              probabilityPercent={(skillProbabilities.get(skill.id) ?? 0) * 100}
              state={skillStates[skill.id] ?? "idle"}
            />
          </Link>
        ))}
      </section>

      {orderedSelectedSkillIds.map((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (!skill) return null;
        const partProbabilities = partProbabilitiesFor(skill);
        const partStates = partStatesBySkillId[skillId] ?? {};
        return (
          <section key={skillId} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-foreground/70">{skill.name} — chọn part</h2>
            <div className="grid grid-cols-2 gap-3">
              {skill.parts.map((part) => (
                <PickCard
                  key={part.id}
                  name={part.name}
                  probabilityPercent={(partProbabilities.get(part.id) ?? 0) * 100}
                  state={partStates[part.id] ?? "idle"}
                />
              ))}
            </div>
            {(typeDrawStatesBySkillId[skillId] ?? []).map((drawStates, drawIndex, allDraws) => {
              const typeProbabilities = typeProbabilitiesFor(skill);
              return (
                <div key={drawIndex} className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium text-foreground/50">
                    Dạng bài{allDraws.length > 1 ? ` (đoạn ${drawIndex + 1})` : ""}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {skill.questionTypes.map((type) => (
                      <PickCard
                        key={type.id}
                        name={type.name}
                        probabilityPercent={(typeProbabilities.get(type.id) ?? 0) * 100}
                        state={drawStates[type.id] ?? "idle"}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleRoll}
          disabled={phase === "rolling"}
          className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "rolling" ? "Đang quay..." : phase === "done" ? "Quay lại" : "Quay"}
        </button>
      </div>

      <ManualPractice skills={skills} onLogged={handlePracticeLogged} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground/70">Lượt quay gần đây</h2>
        <RecentRolls sessions={recentRolls} onDeleted={handleHistoryDeleted} />
      </section>
    </main>
  );
}
