"use client";

import { useState } from "react";
import type { CambridgeTestDTO } from "@/lib/types";
import { CambridgeRow } from "./CambridgeRow";

interface FormState {
  testDate: string;
  testName: string;
  readingBand: string;
  listeningBand: string;
  writingBand: string;
  speakingBand: string;
  note: string;
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    testDate: todayInputValue(),
    testName: "",
    readingBand: "",
    listeningBand: "",
    writingBand: "",
    speakingBand: "",
    note: "",
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

const BAND_FIELDS: { key: keyof FormState; label: string }[] = [
  { key: "readingBand", label: "Reading" },
  { key: "listeningBand", label: "Listening" },
  { key: "writingBand", label: "Writing" },
  { key: "speakingBand", label: "Speaking" },
];

interface CambridgeTrackerProps {
  initialResults: CambridgeTestDTO[];
  /** Called after any successful create/edit/delete, so a sibling (e.g. the prediction cards) can refresh. */
  onChanged?: () => void;
}

export function CambridgeTracker({ initialResults, onChanged }: CambridgeTrackerProps) {
  const [results, setResults] = useState<CambridgeTestDTO[]>(initialResults);
  const [showingAll, setShowingAll] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function validate(): string | null {
    if (!form.testDate) return "Vui lòng chọn ngày thi.";
    if (form.testName.trim().length === 0) return "Vui lòng nhập tên đề thi.";
    for (const { key, label } of BAND_FIELDS) {
      const value = Number(form[key]);
      if (form[key].trim() === "" || !Number.isFinite(value) || value < 0 || value > 9) {
        return `Điểm ${label} phải là số từ 0 đến 9.`;
      }
    }
    return null;
  }

  async function refreshList(nextShowingAll: boolean) {
    setIsLoadingList(true);
    try {
      const url = nextShowingAll ? "/api/cambridge?all=true" : "/api/cambridge?limit=5";
      const data = await fetchJson<CambridgeTestDTO[]>(url);
      setResults(data);
    } catch {
      setErrorMessage("Không tải được danh sách kết quả.");
    } finally {
      setIsLoadingList(false);
    }
  }

  async function handleToggleShowAll() {
    const next = !showingAll;
    setShowingAll(next);
    await refreshList(next);
  }

  function startEdit(result: CambridgeTestDTO) {
    setEditingId(result.id);
    setForm({
      testDate: result.testDate.slice(0, 10),
      testName: result.testName,
      readingBand: String(result.readingBand),
      listeningBand: String(result.listeningBand),
      writingBand: String(result.writingBand),
      speakingBand: String(result.speakingBand),
      note: result.note ?? "",
    });
    setErrorMessage(null);
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      testDate: form.testDate,
      testName: form.testName.trim(),
      readingBand: Number(form.readingBand),
      listeningBand: Number(form.listeningBand),
      writingBand: Number(form.writingBand),
      speakingBand: Number(form.speakingBand),
      // Explicit `null` (not `undefined`) so JSON.stringify keeps the key: PATCH needs to
      // be able to tell "clear an existing note" apart from "note field wasn't sent at all"
      // (see PATCH /api/cambridge/:id, which only clears the note when the key is present).
      note: form.note.trim() || null,
    };

    try {
      if (editingId) {
        await fetchJson(`/api/cambridge/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson("/api/cambridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await refreshList(showingAll);
      onChanged?.();
    } catch {
      setErrorMessage("Lưu kết quả thất bại. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Xóa kết quả thi này?")) return;
    try {
      await fetchJson(`/api/cambridge/${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      await refreshList(showingAll);
      onChanged?.();
    } catch {
      setErrorMessage("Xóa kết quả thất bại. Kiểm tra kết nối rồi thử lại.");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Kết quả thi thử Cambridge</h2>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-foreground/60">
            Ngày thi
            <input
              type="date"
              value={form.testDate}
              onChange={(e) => setForm((f) => ({ ...f, testDate: e.target.value }))}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-foreground/60">
            Tên đề thi
            <input
              type="text"
              value={form.testName}
              onChange={(e) => setForm((f) => ({ ...f, testName: e.target.value }))}
              placeholder="Cambridge 18 - Test 2"
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BAND_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1 text-sm text-foreground/60">
              {label}
              <input
                type="number"
                min={0}
                max={9}
                step={0.5}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm text-foreground/60">
          Ghi chú (tùy chọn)
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>

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
            {isSaving ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm kết quả"}
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-4 text-center text-sm text-foreground/50">Chưa có kết quả thi thử nào.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {results.map((result) => (
              <CambridgeRow
                key={result.id}
                result={result}
                onEdit={() => startEdit(result)}
                onDelete={() => handleDelete(result.id)}
              />
            ))}
          </ul>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleToggleShowAll}
              disabled={isLoadingList}
              className="text-sm font-medium text-foreground/60 hover:text-foreground hover:underline disabled:opacity-50"
            >
              {isLoadingList ? "Đang tải..." : showingAll ? "Thu gọn" : "Xem tất cả"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
