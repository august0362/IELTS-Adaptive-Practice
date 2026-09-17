import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Spinner } from "../../components/spinner/Spinner";
import type { SkillDTO } from "../../lib/types";
import { mockFetchSequence } from "./mockFetch";

// The animation's own timing/landing-index correctness is covered by
// src/tests/unit/spinnerAnimation.test.ts. Here it's mocked to resolve
// instantly so this test exercises the roll state machine / API wiring
// without waiting out several real seconds of decelerating cycles.
//
// The mock still records the `length` it was called with (via `cycleAnimationCalls`,
// declared through vi.hoisted so it exists before this factory runs) so a test
// below can confirm runRollSequence's candidate pool actually narrows between the
// skill draw for the 1st result and the skill draw for the 2nd — landing on the
// right final skill/part by matching `code` would otherwise pass even if that
// narrowing were silently broken (e.g. the filter turned into a no-op), since
// `chosenSkill = candidateSkills[landIndex]` is self-consistent regardless of
// pool size.
const { cycleAnimationCalls } = vi.hoisted(() => ({
  cycleAnimationCalls: [] as { length: number; landOnIndex: number }[],
}));

vi.mock("@/lib/spinnerAnimation", () => ({
  runCycleAnimation: (length: number, landOnIndex: number, onStep: (i: number) => void) => {
    cycleAnimationCalls.push({ length, landOnIndex });
    onStep(landOnIndex);
    return Promise.resolve();
  },
  sleep: () => Promise.resolve(),
}));

beforeEach(() => {
  cycleAnimationCalls.length = 0;
});

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

    // Calls alternate skill-draw/part-draw per result: index 0 is the skill
    // draw for the 1st result (over all 4 candidates), index 2 is the skill
    // draw for the 2nd result — it must run over a pool already narrowed to 3
    // (Reading removed), not the full 4 again.
    expect(cycleAnimationCalls[0].length).toBe(4);
    expect(cycleAnimationCalls[2].length).toBe(3);
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
