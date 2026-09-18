import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PredictionCards } from "../../components/prediction/PredictionCards";
import type { PredictionResponseDTO } from "../../lib/types";

function makeSkillResult(overrides: Partial<PredictionResponseDTO["perSkill"]["reading"]> = {}) {
  return {
    predictedBand: null,
    rawPredictedBand: null,
    cambridgeEwma: null,
    accuracyEwma: null,
    frequencyDelta: 0,
    sampleSize: 0,
    ...overrides,
  };
}

describe("PredictionCards", () => {
  it("shows 'Chưa đủ dữ liệu' for a skill with no predicted band", () => {
    const prediction: PredictionResponseDTO = {
      perSkill: {
        reading: makeSkillResult(),
        listening: makeSkillResult({ predictedBand: 7, sampleSize: 3 }),
        writing: makeSkillResult(),
        speaking: makeSkillResult(),
      },
      overall: null,
      sampleSizePerSkill: { reading: 0, listening: 3, writing: 0, speaking: 0 },
      practiceCount30dPerSkill: { reading: 0, listening: 0, writing: 0, speaking: 0 },
      hasEnoughData: false,
    };

    render(<PredictionCards prediction={prediction} />);

    expect(screen.getAllByText("Chưa đủ dữ liệu")).toHaveLength(3); // reading, writing, speaking
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3 bài thi thử")).toBeInTheDocument();
  });

  it("shows the overall predicted band when all 4 skills have data", () => {
    const prediction: PredictionResponseDTO = {
      perSkill: {
        reading: makeSkillResult({ predictedBand: 6.5, sampleSize: 2 }),
        listening: makeSkillResult({ predictedBand: 7, sampleSize: 2 }),
        writing: makeSkillResult({ predictedBand: 6, sampleSize: 2 }),
        speaking: makeSkillResult({ predictedBand: 6.5, sampleSize: 2 }),
      },
      overall: 6.5,
      sampleSizePerSkill: { reading: 2, listening: 2, writing: 2, speaking: 2 },
      practiceCount30dPerSkill: { reading: 1, listening: 1, writing: 1, speaking: 1 },
      hasEnoughData: true,
    };

    render(<PredictionCards prediction={prediction} />);

    expect(screen.queryByText("Chưa đủ dữ liệu")).not.toBeInTheDocument();
    expect(screen.queryByText("Cần đủ dữ liệu cả 4 kỹ năng")).not.toBeInTheDocument();
    expect(screen.getByText("6.5", { selector: ".text-3xl" })).toBeInTheDocument();
  });

  it("shows a prompt for more data when overall is null even though some skills have data", () => {
    const prediction: PredictionResponseDTO = {
      perSkill: {
        reading: makeSkillResult({ predictedBand: 6.5, sampleSize: 1 }),
        listening: makeSkillResult(),
        writing: makeSkillResult({ predictedBand: 6, sampleSize: 1 }),
        speaking: makeSkillResult({ predictedBand: 6.5, sampleSize: 1 }),
      },
      overall: null,
      sampleSizePerSkill: { reading: 1, listening: 0, writing: 1, speaking: 1 },
      practiceCount30dPerSkill: { reading: 0, listening: 0, writing: 0, speaking: 0 },
      hasEnoughData: false,
    };

    render(<PredictionCards prediction={prediction} />);

    expect(screen.getByText("Cần đủ dữ liệu cả 4 kỹ năng")).toBeInTheDocument();
  });
});
