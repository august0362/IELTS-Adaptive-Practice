import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Topics } from "../../components/settings/Topics";
import type { TopicDTO } from "../../lib/types";
import { mockFetchSequence } from "./mockFetch";

describe("Topics", () => {
  it("shows the empty state when there are no topics", () => {
    render(<Topics initialTopics={[]} />);
    expect(screen.getByText("Chưa có chủ đề nào.")).toBeInTheDocument();
  });

  it("adds a topic and renders it in the list", async () => {
    const user = userEvent.setup();
    const created: TopicDTO = { id: "t1", name: "Environment", createdAt: "2026-01-01T00:00:00.000Z" };
    mockFetchSequence([{ status: 201, json: created }]);

    render(<Topics initialTopics={[]} />);
    await user.type(screen.getByPlaceholderText(/Tên chủ đề/), "Environment");
    await user.click(screen.getByRole("button", { name: "Thêm chủ đề" }));

    expect(await screen.findByText("Environment")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Tên chủ đề/)).toHaveValue("");
  });

  it("removes a topic optimistically and keeps it removed on a successful delete", async () => {
    const user = userEvent.setup();
    const existing: TopicDTO = { id: "t1", name: "Environment", createdAt: "2026-01-01T00:00:00.000Z" };
    mockFetchSequence([{ json: { ok: true } }]);

    render(<Topics initialTopics={[existing]} />);
    await user.click(screen.getByRole("button", { name: "Xóa chủ đề Environment" }));

    expect(screen.queryByText("Environment")).not.toBeInTheDocument();
  });

  it("restores the topic and shows an error if the delete request fails", async () => {
    const user = userEvent.setup();
    const existing: TopicDTO = { id: "t1", name: "Environment", createdAt: "2026-01-01T00:00:00.000Z" };
    mockFetchSequence([{ status: 500, json: { error: "boom" } }]);

    render(<Topics initialTopics={[existing]} />);
    await user.click(screen.getByRole("button", { name: "Xóa chủ đề Environment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Xóa chủ đề thất bại");
    expect(screen.getByText("Environment")).toBeInTheDocument();
  });
});
