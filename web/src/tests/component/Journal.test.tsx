import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Journal } from "../../components/journal/Journal";
import type { NoteDTO } from "../../lib/types";
import { mockFetchSequence } from "./mockFetch";

function makeNote(overrides: Partial<NoteDTO> = {}): NoteDTO {
  return {
    id: "note-1",
    noteDate: "2026-09-17T00:00:00.000Z",
    tags: "",
    content: "nội dung mẫu",
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("Journal", () => {
  it("extracts #tags from the saved content and shows them as filter chips", async () => {
    const user = userEvent.setup();
    const created = makeNote({ id: "new-1", tags: "Reading", content: "Học từ vựng #Reading hôm nay" });
    mockFetchSequence([{ json: created }]);

    render(<Journal initialNotes={[]} />);

    await user.type(screen.getByLabelText("Nội dung ghi chú"), "Học từ vựng #Reading hôm nay");
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú" }));

    expect(await screen.findByRole("button", { name: "#Reading" })).toBeInTheDocument();
    expect(screen.getByText("Học từ vựng #Reading hôm nay")).toBeInTheDocument();
  });

  it("filters the note list when a tag chip is clicked", async () => {
    const user = userEvent.setup();
    const notes = [
      makeNote({ id: "a", tags: "Reading", content: "Ghi chú Reading" }),
      makeNote({ id: "b", tags: "Writing", content: "Ghi chú Writing" }),
    ];

    render(<Journal initialNotes={notes} />);

    expect(screen.getByText("Ghi chú Reading")).toBeInTheDocument();
    expect(screen.getByText("Ghi chú Writing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "#Reading" }));

    expect(screen.getByText("Ghi chú Reading")).toBeInTheDocument();
    expect(screen.queryByText("Ghi chú Writing")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tất cả" }));

    expect(screen.getByText("Ghi chú Writing")).toBeInTheDocument();
  });

  it("shows a validation error instead of saving when content is empty", async () => {
    const user = userEvent.setup();
    const { fetchMock } = mockFetchSequence([{ json: makeNote() }]);

    render(<Journal initialNotes={[]} />);
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nội dung không được để trống.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
