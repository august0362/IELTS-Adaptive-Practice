import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundingModeToggle } from "../../components/prediction/RoundingModeToggle";

describe("RoundingModeToggle", () => {
  it("checks the radio matching the current mode", () => {
    render(<RoundingModeToggle mode="per_skill_rounded" onChange={vi.fn()} isSaving={false} />);

    expect(screen.getByLabelText("Làm tròn từng kỹ năng trước")).toBeChecked();
    expect(screen.getByLabelText("Tính trung bình rồi làm tròn 1 lần")).not.toBeChecked();
  });

  it("calls onChange with the new mode when the other option is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RoundingModeToggle mode="per_skill_rounded" onChange={onChange} isSaving={false} />);

    await user.click(screen.getByLabelText("Tính trung bình rồi làm tròn 1 lần"));

    expect(onChange).toHaveBeenCalledWith("raw_average");
  });

  it("disables both radios while saving", () => {
    render(<RoundingModeToggle mode="per_skill_rounded" onChange={vi.fn()} isSaving={true} />);

    expect(screen.getByLabelText("Làm tròn từng kỹ năng trước")).toBeDisabled();
    expect(screen.getByLabelText("Tính trung bình rồi làm tròn 1 lần")).toBeDisabled();
  });
});
