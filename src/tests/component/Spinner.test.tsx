import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Spinner } from "../../components/spinner/Spinner";
import type { SkillDTO } from "../../lib/types";
import { mockFetchSequence } from "./mockFetch";

// The animation's own timing/landing-index correctness is covered by
// src/tests/unit/spinnerAnimation.test.ts. Here it's mocked to resolve
// instantly so this test exercises the roll state machine / API wiring
// without waiting out several real seconds of decelerating cycles.
vi.mock("@/lib/spinnerAnimation", () => ({
  runCycleAnimation: (_length: number, landOnIndex: number, onStep: (i: number) => void) => {
    onStep(landOnIndex);
    return Promise.resolve();
  },
  sleep: () => Promise.resolve(),
}));

function makeSkills(): SkillDTO[] {
  const skill = (code: string, name: string, partPrefix: string): SkillDTO => ({
    id: code,
    code,
    name,
    occurrenceCount: 0,
    lastAppearedAt: null,
    parts: [
      { id: `${partPrefix}_A`, skillId: code, code: `${partPrefix}_A`, name: "Part A", baseRatio: 0.6, occurrenceCount: 0, lastAppearedAt: null },
      { id: `${partPrefix}_B`, skillId: code, code: `${partPrefix}_B`, name: "Part B", baseRatio: 0.4, occurrenceCount: 0, lastAppearedAt: null },
    ],
  });

  return [
    skill("READING", "Reading", "READING"),
    skill("LISTENING", "Listening", "LISTENING"),
    skill("WRITING", "Writing", "WRITING"),
    skill("SPEAKING", "Speaking", "SPEAKING"),
  ];
}

describe("Spinner", () => {
  it("reveals the server-chosen skills and parts after a roll", async () => {
    const user = userEvent.setup();
    const skills = makeSkills();

    mockFetchSequence([
      {
        json: {
          sessionId: "s1",
          results: [
            { skill: { id: "READING", code: "READING", name: "Reading" }, part: { id: "READING_A", code: "READING_A", name: "Part A" } },
            { skill: { id: "LISTENING", code: "LISTENING", name: "Listening" }, part: { id: "LISTENING_B", code: "LISTENING_B", name: "Part B" } },
          ],
        },
      },
      { json: skills },
      { json: { items: [] } },
    ]);

    render(<Spinner initialSkills={skills} initialDecayExponent={1} initialRecentRolls={[]} />);

    await user.click(screen.getByRole("button", { name: "Quay" }));

    expect(await screen.findByRole("button", { name: "Quay lại" })).toBeInTheDocument();
    expect(screen.getByText("Reading — chọn part")).toBeInTheDocument();
    expect(screen.getByText("Listening — chọn part")).toBeInTheDocument();
    expect(screen.queryByText("Writing — chọn part")).not.toBeInTheDocument();
    expect(screen.queryByText("Speaking — chọn part")).not.toBeInTheDocument();
  });

  it("shows an error and re-enables the button when the roll request fails", async () => {
    const user = userEvent.setup();
    const skills = makeSkills();

    mockFetchSequence([{ status: 500, json: { error: "boom" } }]);

    render(<Spinner initialSkills={skills} initialDecayExponent={1} initialRecentRolls={[]} />);

    await user.click(screen.getByRole("button", { name: "Quay" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Quay thất bại");
    expect(screen.getByRole("button", { name: "Quay" })).toBeEnabled();
  });

  it("shows the empty state for recent rolls when there is no history yet", () => {
    const skills = makeSkills();
    render(<Spinner initialSkills={skills} initialDecayExponent={1} initialRecentRolls={[]} />);

    expect(screen.getByText("Chưa có lượt quay nào.")).toBeInTheDocument();
  });
});
