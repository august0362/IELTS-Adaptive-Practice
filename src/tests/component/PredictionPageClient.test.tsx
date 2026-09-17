import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PredictionPageClient } from "../../components/prediction/PredictionPageClient";
import type { PredictionResponseDTO, SkillPredictionResultDTO } from "../../lib/types";
import { mockFetchSequence } from "./mockFetch";

// RoundingModeToggle.test.tsx covers the toggle in isolation (checked state,
// onChange payload, disabled-while-saving). This file covers the one thing an
// isolated toggle test can't: that PredictionPageClient actually wires
// `onChange` to a real PATCH /api/config call followed by a prediction
// refresh, per CLAUDE.md's "prediction toggle states" requirement.

function makeSkillResult(overrides: Partial<SkillPredictionResultDTO> = {}): SkillPredictionResultDTO {
  return {
    predictedBand: null,
    rawPredictedBand: null,
    cambridgeAvg: null,
    frequencyDelta: 0,
    sampleSize: 0,
    ...overrides,
  };
}

function makePrediction(overrides: Partial<PredictionResponseDTO> = {}): PredictionResponseDTO {
  return {
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
    ...overrides,
  };
}

describe("PredictionPageClient", () => {
  it("PATCHes /api/config and refreshes the prediction when the rounding mode changes", async () => {
    const user = userEvent.setup();
    const refreshedPrediction = makePrediction({ overall: 7 });

    const { fetchMock } = mockFetchSequence([
      { json: { overall_prediction_rounding_mode: "raw_average" } }, // PATCH /api/config response
      { json: refreshedPrediction }, // GET /api/prediction response
    ]);

    render(
      <PredictionPageClient
        initialPrediction={makePrediction()}
        initialCambridgeResults={[]}
        initialSkills={[]}
        initialRoundingMode="per_skill_rounded"
      />
    );

    await user.click(screen.getByLabelText("Tính trung bình rồi làm tròn 1 lần"));

    // Overall goes from 6.5 to 7 only if the refreshed prediction was actually
    // fetched and rendered, not just the toggle's own local checked state.
    expect(await screen.findByText("7", { selector: ".text-3xl" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tính trung bình rồi làm tròn 1 lần")).toBeChecked();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/config",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ key: "overall_prediction_rounding_mode", value: "raw_average" }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/prediction", undefined);
  });

  it("shows an error and keeps the previous mode when the PATCH fails", async () => {
    const user = userEvent.setup();
    mockFetchSequence([{ status: 500, json: { error: "boom" } }]);

    render(
      <PredictionPageClient
        initialPrediction={makePrediction()}
        initialCambridgeResults={[]}
        initialSkills={[]}
        initialRoundingMode="per_skill_rounded"
      />
    );

    await user.click(screen.getByLabelText("Tính trung bình rồi làm tròn 1 lần"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Đổi cách tính thất bại");
    expect(screen.getByLabelText("Làm tròn từng kỹ năng trước")).toBeChecked();
  });
});
