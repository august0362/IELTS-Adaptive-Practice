import type { SkillStatsResponse } from "@/lib/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PracticeLog({ entries }: { entries: SkillStatsResponse["practiceLog"] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-foreground/50">Chưa luyện kỹ năng này lần nào.</p>;
  }

  return (
    <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
      {entries.map((entry, i) => (
        <li
          key={i}
          // See RecentRolls.tsx's identical comment: opaque now instead of `bg-surface/70`
          // now that the page background no longer shares a dark theme's own dark tier.
          className="surface-glow flex flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-surface-foreground/50">{formatDateTime(entry.rolledAt)}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-surface-foreground">{entry.part.name}</span>
            {entry.source === "manual" && (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                Tự học
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
