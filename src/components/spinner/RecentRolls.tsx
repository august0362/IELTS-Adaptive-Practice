import type { HistorySession } from "@/lib/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentRolls({ sessions }: { sessions: HistorySession[] }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-foreground/50">Chưa có lượt quay nào.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="flex flex-col gap-1 rounded-lg border border-black/10 bg-white/50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-foreground/50">{formatDateTime(session.rolledAt)}</span>
          <span className="font-medium">
            {session.results.map((r) => `${r.skill.name} · ${r.part.name}`).join("  —  ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
