import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManualPractice } from "../../components/spinner/ManualPractice";
import type { SkillDTO } from "../../lib/types";
import { mockFetchSequence } from "./mockFetch";

function makeSkills(): SkillDTO[] {
  return [
    {
      id: "READING",
      code: "READING",
      name: "Reading",
      occurrenceCount: 0,
      lastAppearedAt: null,
      parts: [
        { id: "READING_A", skillId: "READING", code: "READING_A", name: "Block A", baseRatio: 0.6, occurrenceCount: 0, lastAppearedAt: null, questionTypeRollCount: 2 },
        { id: "READING_B", skillId: "READING", code: "READING_B", name: "Block B", baseRatio: 0.4, occurrenceCount: 0, lastAppearedAt: null, questionTypeRollCount: 1 },
      ],
      questionTypes: [
        { id: "RT1", skillId: "READING", code: "RT1", name: "Matching Headings", baseRatio: 1, occurrenceCount: 0, lastAppearedAt: null },
      ],
    },
    {
      id: "SPEAKING",
      code: "SPEAKING",
      name: "Speaking",
      occurrenceCount: 0,
      lastAppearedAt: null,
      parts: [
        { id: "SPEAKING_A", skillId: "SPEAKING", code: "SPEAKING_A", name: "Block A", baseRatio: 0.6, occurrenceCount: 0, lastAppearedAt: null, questionTypeRollCount: 0 },
      ],
      questionTypes: [],
    },
  ];
}

describe("ManualPractice", () => {
  it("shows the question-type select only when the selected part has questionTypeRollCount > 0", async () => {
    const user = userEvent.setup();
    render(<ManualPractice skills={makeSkills()} onLogged={vi.fn()} />);

    // Default selection is Reading / Block A (rollCount 2) — type select present.
    expect(screen.getByText("Dạng bài (tùy chọn)")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Kỹ năng"), "SPEAKING");
    expect(screen.queryByText("Dạng bài (tùy chọn)")).not.toBeInTheDocument();
  });

  it("submits Skill + Part + Type and reports a confirmation on success", async () => {
    const user = userEvent.setup();
    const onLogged = vi.fn();
    const { fetchMock } = mockFetchSequence([
      {
        json: {
          sessionId: "s1",
          resultId: "r1",
          source: "manual",
          skill: { id: "READING", code: "READING", name: "Reading" },
          part: { id: "READING_A", code: "READING_A", name: "Block A" },
          questionType: { id: "RT1", code: "RT1", name: "Matching Headings" },
        },
      },
    ]);

    render(<ManualPractice skills={makeSkills()} onLogged={onLogged} />);
    await user.selectOptions(screen.getByLabelText("Dạng bài (tùy chọn)"), "RT1");
    await user.click(screen.getByRole("button", { name: "Ghi nhận" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/practice",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ skillCode: "READING", partCode: "READING_A", questionTypeCode: "RT1" }),
      })
    );
    expect(await screen.findByText(/Đã ghi nhận: Reading · Block A \(Matching Headings\)/)).toBeInTheDocument();
    expect(onLogged).toHaveBeenCalled();
    // Reading is an accuracy-tracked skill — the quick accuracy entry should appear.
    expect(screen.getByLabelText("Số câu đã làm")).toBeInTheDocument();
  });

  it("does not show the accuracy entry after logging a skill with no accuracy component (e.g. Speaking)", async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      {
        json: {
          sessionId: "s1",
          resultId: "r1",
          source: "manual",
          skill: { id: "SPEAKING", code: "SPEAKING", name: "Speaking" },
          part: { id: "SPEAKING_A", code: "SPEAKING_A", name: "Block A" },
          questionType: null,
        },
      },
    ]);

    render(<ManualPractice skills={makeSkills()} onLogged={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("Kỹ năng"), "SPEAKING");
    await user.click(screen.getByRole("button", { name: "Ghi nhận" }));

    expect(await screen.findByText(/Đã ghi nhận: Speaking/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Số câu đã làm")).not.toBeInTheDocument();
  });

  it("shows an error when the request fails", async () => {
    const user = userEvent.setup();
    mockFetchSequence([{ status: 500, json: { error: "boom" } }]);

    render(<ManualPractice skills={makeSkills()} onLogged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Ghi nhận" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ghi nhận thất bại");
  });
});
