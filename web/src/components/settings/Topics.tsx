"use client";

import { useState } from "react";
import type { TopicDTO } from "@/lib/types";

/**
 * Minimal CRUD for user-defined practice topics (PROJECT_CONTEXT.md 5.11).
 * Deliberately just a name for now, not wired into the roll — the user said
 * more fields are coming later, so this stays small rather than guessing
 * at an integration that would need reworking once the fields are known.
 */
export function Topics({ initialTopics }: { initialTopics: TopicDTO[] }) {
  const [topics, setTopics] = useState<TopicDTO[]>(initialTopics);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const created = (await res.json()) as TopicDTO;
      setTopics((prev) => [created, ...prev]);
      setName("");
    } catch {
      setErrorMessage("Thêm chủ đề thất bại. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setStatus("idle");
    }
  }

  async function handleDelete(id: string) {
    const previous = topics;
    setTopics((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/topics/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed with ${res.status}`);
    } catch {
      setTopics(previous);
      setErrorMessage("Xóa chủ đề thất bại. Kiểm tra kết nối rồi thử lại.");
    }
  }

  return (
    <section className="surface-glow flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-medium text-surface-foreground/70">Chủ đề luyện tập</h2>
        <p className="mt-0.5 text-xs text-surface-foreground/50">Tự thêm chủ đề để theo dõi riêng — chưa gắn vào vòng quay.</p>
      </div>

      {errorMessage && (
        <p role="alert" className="text-xs text-red-600">
          {errorMessage}
        </p>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên chủ đề, ví dụ: Environment"
          className="input-paper flex-1 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={status === "saving" || name.trim().length === 0}
          aria-label="Thêm chủ đề"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-lg font-semibold leading-none text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </form>

      {topics.length === 0 ? (
        <p className="text-sm text-surface-foreground/50">Chưa có chủ đề nào.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors hover:border-primary/30"
            >
              <span>{topic.name}</span>
              <button
                type="button"
                onClick={() => handleDelete(topic.id)}
                aria-label={`Xóa chủ đề ${topic.name}`}
                className="text-foreground/40 transition-colors hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
