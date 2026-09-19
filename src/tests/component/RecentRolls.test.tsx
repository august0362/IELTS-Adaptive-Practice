import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecentRolls } from "../../components/spinner/RecentRolls";
import type { HistorySession } from "../../lib/types";
import { mockFetchSequence } from "./mockFetch";

function makeSession(overrides: Partial<HistorySession> = {}): HistorySession {
  return {
    id: "s1",
    rolledAt: "2026-01-01T10:00:00.000Z",
    source: "roll",
    results: [
      {
        id: "r1",
        skill: { id: "READING", code: "READING", name: "Reading" },
        part: { id: "READING_A", code: "READING_A", name: "Block A" },
        questionTypes: [{ id: "t1", code: "T1", name: "Matching Headings" }],
        questionsAnswered: null,
        questionsCorrect: null,
      },
    ],
    ...overrides,
  };
}

describe("RecentRolls", () => {
  it("shows the empty state when there is no history", () => {
    render(<RecentRolls sessions={[]} />);
    expect(screen.getByText("Chưa có lượt quay nào.")).toBeInTheDocument();
  });

  it("shows question-type names inline with the result and a 'Tự học' badge for manual entries", () => {
    render(<RecentRolls sessions={[makeSession({ source: "manual" })]} />);
    expect(screen.getByText(/Matching Headings/)).toBeInTheDocument();
    expect(screen.getByText("Tự học")).toBeInTheDocument();
  });

  it("does not show the 'Tự học' badge for a real roll", () => {
    render(<RecentRolls sessions={[makeSession({ source: "roll" })]} />);
    expect(screen.queryByText("Tự học")).not.toBeInTheDocument();
  });

  it("deletes a session and calls onDeleted on success, after the user confirms", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { fetchMock } = mockFetchSequence([{ json: { ok: true } }]);
    const onDeleted = vi.fn();

    render(<RecentRolls sessions={[makeSession()]} onDeleted={onDeleted} />);
    await user.click(screen.getByRole("button", { name: /Xóa lượt quay/ }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/history/s1", { method: "DELETE" });
    expect(onDeleted).toHaveBeenCalledWith("s1");
  });

  it("does not call the delete API when the user cancels the confirm dialog", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { fetchMock } = mockFetchSequence([{ json: { ok: true } }]);
    const onDeleted = vi.fn();

    render(<RecentRolls sessions={[makeSession()]} onDeleted={onDeleted} />);
    await user.click(screen.getByRole("button", { name: /Xóa lượt quay/ }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("shows an error and does not call onDeleted when the delete request fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetchSequence([{ status: 500, json: { error: "boom" } }]);
    const onDeleted = vi.fn();

    render(<RecentRolls sessions={[makeSession()]} onDeleted={onDeleted} />);
    await user.click(screen.getByRole("button", { name: /Xóa lượt quay/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Xóa lượt quay thất bại");
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("offers a 'Nhập số câu đúng' prompt for a Reading/Listening result with no accuracy recorded yet", () => {
    render(<RecentRolls sessions={[makeSession()]} />);
    expect(screen.getByRole("button", { name: "+ Nhập số câu đúng" })).toBeInTheDocument();
  });

  it("expands into the accuracy-entry form when the prompt is clicked, and shows a saved confirmation after saving", async () => {
    const user = userEvent.setup();
    mockFetchSequence([{ json: { id: "r1", questionsAnswered: 20, questionsCorrect: 18 } }]);

    render(<RecentRolls sessions={[makeSession()]} />);
    await user.click(screen.getByRole("button", { name: "+ Nhập số câu đúng" }));

    expect(screen.getByLabelText("Số câu đã làm")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Số câu đã làm"), "20");
    await user.type(screen.getByLabelText("Số câu đúng"), "18");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("✓ Đã ghi số câu đúng: 18/20")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Nhập số câu đúng" })).not.toBeInTheDocument();
  });

  it("shows the already-recorded numbers instead of the prompt when the result already has accuracy data", () => {
    const session = makeSession({
      results: [
        {
          id: "r1",
          skill: { id: "READING", code: "READING", name: "Reading" },
          part: { id: "READING_A", code: "READING_A", name: "Block A" },
          questionTypes: [],
          questionsAnswered: 20,
          questionsCorrect: 18,
        },
      ],
    });
    render(<RecentRolls sessions={[session]} />);
    expect(screen.getByText("✓ Đã ghi số câu đúng: 18/20")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Nhập số câu đúng" })).not.toBeInTheDocument();
  });

  it("does not offer accuracy entry for a skill with no accuracy component (e.g. Speaking)", () => {
    const session = makeSession({
      results: [
        {
          id: "r1",
          skill: { id: "SPEAKING", code: "SPEAKING", name: "Speaking" },
          part: { id: "SPEAKING_A", code: "SPEAKING_A", name: "Block A" },
          questionTypes: [],
          questionsAnswered: null,
          questionsCorrect: null,
        },
      ],
    });
    render(<RecentRolls sessions={[session]} />);
    expect(screen.queryByRole("button", { name: "+ Nhập số câu đúng" })).not.toBeInTheDocument();
  });
});
