import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PracticeLog } from "../../components/stats/PracticeLog";
import type { SkillStatsResponse } from "../../lib/types";

describe("PracticeLog", () => {
  it("shows the empty state when there are no entries", () => {
    render(<PracticeLog entries={[]} />);
    expect(screen.getByText("Chưa luyện kỹ năng này lần nào.")).toBeInTheDocument();
  });

  it("renders each entry's part name and a 'Tự học' badge only for manual entries", () => {
    const entries: SkillStatsResponse["practiceLog"] = [
      {
        rolledAt: "2026-01-02T00:00:00.000Z",
        source: "manual",
        part: { code: "READING_A", name: "Block A" },
        questionsAnswered: null,
        questionsCorrect: null,
      },
      {
        rolledAt: "2026-01-01T00:00:00.000Z",
        source: "roll",
        part: { code: "READING_B", name: "Block B" },
        questionsAnswered: 20,
        questionsCorrect: 18,
      },
    ];
    render(<PracticeLog entries={entries} />);

    expect(screen.getByText("Block A")).toBeInTheDocument();
    expect(screen.getByText("Block B")).toBeInTheDocument();
    expect(screen.getAllByText("Tự học")).toHaveLength(1);
  });
});
