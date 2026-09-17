import { useState } from "react";
import type { SkillDTO } from "@/lib/types";

interface RatioSliderProps {
  skillName: string;
  blockA: { id: string; name: string; baseRatio: number };
  blockB: { id: string; name: string; baseRatio: number };
  onSave: (blockAPartId: string, ratio: number) => void;
}

function RatioSlider({ skillName, blockA, blockB, onSave }: RatioSliderProps) {
  const [percent, setPercent] = useState(Math.round(blockA.baseRatio * 100));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-foreground/60">
        <span className="font-medium text-foreground">{skillName}</span>
        <span>
          {blockA.name}: {percent}% — {blockB.name}: {100 - percent}%
        </span>
      </div>
      <input
        type="range"
        min={10}
        max={90}
        step={5}
        value={percent}
        onChange={(e) => setPercent(Number(e.target.value))}
        onPointerUp={() => onSave(blockA.id, percent / 100)}
        aria-label={`Tỉ lệ ${skillName}: ${blockA.name} so với ${blockB.name}`}
        aria-valuetext={`${blockA.name} ${percent}%, ${blockB.name} ${100 - percent}%`}
        className="w-full accent-foreground"
      />
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export function RatioSliders({ skills }: { skills: SkillDTO[] }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const adjustableSkills = skills.filter((s) => s.code === "READING" || s.code === "SPEAKING");

  async function handleSave(blockAPartId: string, ratio: number) {
    try {
      await fetchJson(`/api/skills/parts/${blockAPartId}/ratio`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseRatio: ratio }),
      });
      setErrorMessage(null);
    } catch {
      setErrorMessage("Lưu tỉ lệ thất bại. Kiểm tra kết nối rồi thử lại.");
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <h2 className="text-sm font-medium text-foreground/70">
        Tỉ lệ Block A / Block B (Speaking &amp; Reading)
      </h2>
      {errorMessage && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
      <div className="flex flex-col gap-4">
        {adjustableSkills.map((skill) => {
          const blockA = skill.parts.find((p) => p.code.endsWith("_BLOCK_A"));
          const blockB = skill.parts.find((p) => p.code.endsWith("_BLOCK_B"));
          if (!blockA || !blockB) return null;
          return (
            <RatioSlider key={skill.id} skillName={skill.name} blockA={blockA} blockB={blockB} onSave={handleSave} />
          );
        })}
      </div>
    </section>
  );
}
