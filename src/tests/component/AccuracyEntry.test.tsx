import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccuracyEntry } from "../../components/spinner/AccuracyEntry";
import { mockFetchSequence } from "./mockFetch";

describe("AccuracyEntry", () => {
  it("PATCHes /api/results/:id/accuracy with the entered numbers and shows a saved confirmation", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const { fetchMock } = mockFetchSequence([{ json: { id: "r1", questionsAnswered: 20, questionsCorrect: 18 } }]);

    render(<AccuracyEntry resultId="r1" onSaved={onSaved} />);
    await user.type(screen.getByLabelText("Số câu đã làm"), "20");
    await user.type(screen.getByLabelText("Số câu đúng"), "18");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/results/r1/accuracy",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ questionsAnswered: 20, questionsCorrect: 18 }),
      })
    );
    expect(await screen.findByText(/Đã lưu số câu đúng/)).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalled();
  });

  it("disables the save button until both fields have a value", () => {
    render(<AccuracyEntry resultId="r1" />);
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  });

  it("shows an error when the request fails", async () => {
    const user = userEvent.setup();
    mockFetchSequence([{ status: 500, json: { error: "boom" } }]);

    render(<AccuracyEntry resultId="r1" />);
    await user.type(screen.getByLabelText("Số câu đã làm"), "20");
    await user.type(screen.getByLabelText("Số câu đúng"), "18");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Lưu số câu đúng thất bại");
  });
});
