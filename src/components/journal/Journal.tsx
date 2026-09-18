"use client";

import { useState } from "react";
import type { NoteDTO } from "@/lib/types";
import { extractTags, parseTagsString, tagsToString } from "@/lib/tagUtils";
import { NoteCard } from "./NoteCard";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export function Journal({ initialNotes }: { initialNotes: NoteDTO[] }) {
  const [notes, setNotes] = useState<NoteDTO[]>(initialNotes);
  const [content, setContent] = useState("");
  const [noteDate, setNoteDate] = useState(todayInputValue());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allTags = Array.from(new Set(notes.flatMap((n) => parseTagsString(n.tags)))).sort();
  const visibleNotes = activeTag ? notes.filter((n) => parseTagsString(n.tags).includes(activeTag)) : notes;

  function resetForm() {
    setContent("");
    setNoteDate(todayInputValue());
    setEditingId(null);
  }

  function startEdit(note: NoteDTO) {
    setEditingId(note.id);
    setContent(note.content);
    setNoteDate(note.noteDate.slice(0, 10));
    setErrorMessage(null);
  }

  async function handleSave() {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      setErrorMessage("Nội dung không được để trống.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    const tags = tagsToString(extractTags(trimmed));

    try {
      if (editingId) {
        const updated = await fetchJson<NoteDTO>(`/api/notes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags, content: trimmed }),
        });
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      } else {
        const created = await fetchJson<NoteDTO>("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteDate, tags, content: trimmed }),
        });
        setNotes((prev) =>
          [created, ...prev].sort((a, b) => (a.noteDate === b.noteDate ? 0 : a.noteDate < b.noteDate ? 1 : -1)),
        );
      }
      resetForm();
    } catch {
      setErrorMessage("Lưu ghi chú thất bại. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Xóa ghi chú này?")) return;
    try {
      await fetchJson(`/api/notes/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (editingId === id) resetForm();
    } catch {
      setErrorMessage("Xóa ghi chú thất bại. Kiểm tra kết nối rồi thử lại.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Nhật ký học tập</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Ghi chú từ vựng, bài học theo ngày. Gõ #tag trong nội dung để gắn nhãn, ví dụ #Reading.
        </p>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <label htmlFor="note-date" className="text-sm text-foreground/60">
            Ngày
          </label>
          <input
            id="note-date"
            type="date"
            value={noteDate}
            onChange={(e) => setNoteDate(e.target.value)}
            disabled={editingId !== null}
            className="input-paper px-2 py-1 text-sm"
          />
        </div>

        <label htmlFor="note-content" className="sr-only">
          Nội dung ghi chú
        </label>
        <textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Viết ghi chú, từ vựng mới, ví dụ: học được idiom mới cho #Writing..."
          className="input-paper w-full resize-y px-3 py-2 text-sm placeholder:text-input-foreground/50"
        />

        <div className="flex justify-end gap-2">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-border"
            >
              Hủy
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Đang lưu..." : editingId ? "Cập nhật" : "Lưu ghi chú"}
          </button>
        </div>
      </section>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeTag === null ? "bg-primary text-primary-foreground" : "bg-border text-foreground/70"
            }`}
          >
            Tất cả
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeTag === tag ? "bg-primary text-primary-foreground" : "bg-border text-foreground/70"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {visibleNotes.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground/50">
          {activeTag ? `Không có ghi chú nào gắn tag #${activeTag}.` : "Chưa có ghi chú nào."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleNotes.map((note) => (
            <NoteCard key={note.id} note={note} onEdit={() => startEdit(note)} onDelete={() => handleDelete(note.id)} />
          ))}
        </ul>
      )}
    </main>
  );
}
