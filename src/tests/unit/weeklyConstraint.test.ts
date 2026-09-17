import { describe, expect, it } from "vitest";
import {
  partitionByWeeklyOverdue,
  pickSkillsWithWeeklyConstraint,
  type SkillForConstraint,
} from "../../lib/engine/weeklyConstraint";

const NOW = new Date("2026-09-17T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("partitionByWeeklyOverdue", () => {
  it("forces nothing when no skill is overdue", () => {
    const items: SkillForConstraint[] = [
      { id: "reading", occurrenceCount: 0, lastAppearedAt: daysAgo(1) },
      { id: "listening", occurrenceCount: 0, lastAppearedAt: daysAgo(2) },
    ];
    const { forced, remaining } = partitionByWeeklyOverdue(items, NOW, 7, 2);
    expect(forced).toHaveLength(0);
    expect(remaining).toHaveLength(2);
  });

  it("treats a never-appeared skill (null lastAppearedAt) as always overdue", () => {
    const items: SkillForConstraint[] = [
      { id: "reading", occurrenceCount: 0, lastAppearedAt: null },
      { id: "listening", occurrenceCount: 0, lastAppearedAt: daysAgo(1) },
    ];
    const { forced } = partitionByWeeklyOverdue(items, NOW, 7, 2);
    expect(forced.map((f) => f.id)).toEqual(["reading"]);
  });

  it("caps forced picks at slotsNeeded, most-overdue first, when 3+ are overdue simultaneously", () => {
    const items: SkillForConstraint[] = [
      { id: "reading", occurrenceCount: 0, lastAppearedAt: daysAgo(8) },
      { id: "listening", occurrenceCount: 0, lastAppearedAt: daysAgo(20) },
      { id: "writing", occurrenceCount: 0, lastAppearedAt: daysAgo(10) },
      { id: "speaking", occurrenceCount: 0, lastAppearedAt: daysAgo(1) },
    ];
    const { forced, remaining } = partitionByWeeklyOverdue(items, NOW, 7, 2);
    expect(forced.map((f) => f.id)).toEqual(["listening", "writing"]);
    expect(remaining.map((r) => r.id)).toEqual(["reading", "speaking"]);
  });
});

describe("pickSkillsWithWeeklyConstraint", () => {
  it("fills remaining slots via weighted draw when only one skill is overdue", () => {
    const items: SkillForConstraint[] = [
      { id: "reading", occurrenceCount: 0, lastAppearedAt: daysAgo(10) }, // overdue -> forced
      { id: "listening", occurrenceCount: 0, lastAppearedAt: daysAgo(1) },
      { id: "writing", occurrenceCount: 0, lastAppearedAt: daysAgo(1) },
      { id: "speaking", occurrenceCount: 0, lastAppearedAt: daysAgo(1) },
    ];
    const picked = pickSkillsWithWeeklyConstraint(items, NOW, 7, 2, { random: () => 0 });
    expect(picked).toHaveLength(2);
    expect(picked.some((p) => p.id === "reading")).toBe(true);
  });

  it("returns exactly slotCount when 2+ skills are overdue (no weighted draw needed)", () => {
    const items: SkillForConstraint[] = [
      { id: "reading", occurrenceCount: 0, lastAppearedAt: daysAgo(10) },
      { id: "listening", occurrenceCount: 0, lastAppearedAt: daysAgo(30) },
      { id: "writing", occurrenceCount: 0, lastAppearedAt: daysAgo(1) },
      { id: "speaking", occurrenceCount: 0, lastAppearedAt: daysAgo(1) },
    ];
    const picked = pickSkillsWithWeeklyConstraint(items, NOW, 7, 2);
    expect(picked.map((p) => p.id).sort()).toEqual(["listening", "reading"]);
  });
});
