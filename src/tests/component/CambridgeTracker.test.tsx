import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CambridgeTracker } from "../../components/prediction/CambridgeTracker";
import type { CambridgeTestDTO } from "../../lib/types";
import { mockFetchSequence } from "./mockFetch";

function makeResult(overrides: Partial<CambridgeTestDTO> = {}): CambridgeTestDTO {
  return {
    id: "r1",
    testDate: "2026-09-01T00:00:00.000Z",
    testName: "Cambridge 18 Test 1",
    readingBand: 6.5,
    listeningBand: 7,
    writingBand: 6,
    speakingBand: 6.5,
    overallBand: 6.5,
    note: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeResults(count: number): CambridgeTestDTO[] {
  return Array.from({ length: count }, (_, i) =>
    makeResult({ id: `r${i}`, testName: `Cambridge Test ${i}` })
  );
}

describe("CambridgeTracker", () => {
  it("shows the initial 5-most-recent results and expands to all on 'Xem tất cả'", async () => {
    const user = userEvent.setup();
    const allResults = makeResults(8);
    const initialFive = allResults.slice(0, 5);

    mockFetchSequence([{ json: allResults }]);

    render(<CambridgeTracker initialResults={initialFive} />);

    expect(screen.getAllByText(/Cambridge Test \d/)).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "Xem tất cả" }));

    expect(await screen.findAllByText(/Cambridge Test \d/)).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Thu gọn" })).toBeInTheDocument();
  });

  it("collapses back to 5 results on 'Thu gọn'", async () => {
    const user = userEvent.setup();
    const allResults = makeResults(8);
    const initialFive = allResults.slice(0, 5);

    mockFetchSequence([{ json: allResults }, { json: initialFive }]);

    render(<CambridgeTracker initialResults={initialFive} />);

    await user.click(screen.getByRole("button", { name: "Xem tất cả" }));
    expect(await screen.findAllByText(/Cambridge Test \d/)).toHaveLength(8);

    await user.click(screen.getByRole("button", { name: "Thu gọn" }));
    expect(await screen.findAllByText(/Cambridge Test \d/)).toHaveLength(5);
  });

  it("shows the empty state when there are no results", () => {
    render(<CambridgeTracker initialResults={[]} />);
    expect(screen.getByText("Chưa có kết quả thi thử nào.")).toBeInTheDocument();
  });

  it("rejects an out-of-range band score before calling the API", async () => {
    const user = userEvent.setup();
    const { fetchMock } = mockFetchSequence([{ json: makeResult() }]);

    render(<CambridgeTracker initialResults={[]} />);

    await user.type(screen.getByLabelText("Tên đề thi"), "Cambridge 19 Test 1");
    await user.type(screen.getByLabelText("Reading"), "9.5");
    await user.type(screen.getByLabelText("Listening"), "7");
    await user.type(screen.getByLabelText("Writing"), "6");
    await user.type(screen.getByLabelText("Speaking"), "6.5");
    await user.click(screen.getByRole("button", { name: "Thêm kết quả" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Điểm Reading phải là số từ 0 đến 9.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
