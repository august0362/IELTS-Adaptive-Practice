"use client";

import { useState } from "react";
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

function formatResult(r: HistorySession["results"][number]): string {
  const typesSuffix = r.questionTypes.length > 0 ? ` [${r.questionTypes.map((t) => t.name).join(", ")}]` : "";
  return `${r.skill.name} · ${r.part.name}${typesSuffix}`;
}

interface RecentRollsProps {
  sessions: HistorySession[];
  onDeleted?: (sessionId: string) => void;
}

export function RecentRolls({ sessions, onDeleted }: RecentRollsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (sessions.length === 0) {
    return <p className="text-sm text-foreground/50">Chưa có lượt quay nào.</p>;
  }

  async function handleDelete(sessionId: string) {
    if (!window.confirm("Xóa lượt quay này? Số liệu đã cộng (bộ đếm, dạng bài) sẽ được hoàn tác.")) return;
    setDeletingId(sessionId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/history/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed with ${res.status}`);
      onDeleted?.(sessionId);
    } catch {
      setErrorMessage("Xóa lượt quay thất bại. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {errorMessage && (
        <p role="alert" className="text-xs text-red-600">
          {errorMessage}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface/70 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-foreground/50">{formatDateTime(session.rolledAt)}</span>
              {session.source === "manual" && (
                <span className="w-fit rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Tự học
                </span>
              )}
            </div>
            <span className="font-medium">{session.results.map(formatResult).join("  —  ")}</span>
            <button
              type="button"
              onClick={() => handleDelete(session.id)}
              disabled={deletingId === session.id}
              aria-label={`Xóa lượt quay lúc ${formatDateTime(session.rolledAt)}`}
              className="w-fit rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deletingId === session.id ? "Đang xóa..." : "Xóa"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
