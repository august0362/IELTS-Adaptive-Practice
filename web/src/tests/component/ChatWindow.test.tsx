import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatWindow } from "../../components/chat/ChatWindow";
import type { ChatConversationListItemDTO } from "../../lib/types";
import { mockFetchSequence } from "./mockFetch";

function makeConversation(overrides: Partial<ChatConversationListItemDTO> = {}): ChatConversationListItemDTO {
  return {
    id: "conv-1",
    title: "Cuộc trò chuyện mới",
    mode: "flash",
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    lastMessagePreview: null,
    ...overrides,
  };
}

describe("ChatWindow", () => {
  it("shows a welcome message when there are no conversations yet", async () => {
    mockFetchSequence([{ json: [] }]);
    render(<ChatWindow />);
    expect(await screen.findByText(/Chào bạn!/)).toBeInTheDocument();
    expect(screen.getByText("Chưa có cuộc trò chuyện nào")).toBeInTheDocument();
  });

  it("sending the first message creates a conversation, shows it immediately, then shows the reply", async () => {
    const user = userEvent.setup();
    const created = makeConversation();
    const { fetchMock } = mockFetchSequence([
      { json: [] }, // mount: conversation list is empty
      { json: created }, // POST conversations (created on first send)
      { json: { reply: "Đây là câu trả lời.", conversationId: created.id } }, // POST /api/chat
      { json: [{ ...created, lastMessagePreview: "Đây là câu trả lời." }] }, // list refresh after send
    ]);

    render(<ChatWindow />);
    await screen.findByText(/Chào bạn!/);

    await user.type(screen.getByLabelText("Nhập câu hỏi"), "App này tính Band thế nào?");
    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(screen.getByText("App này tính Band thế nào?")).toBeInTheDocument();
    expect(await screen.findByText("Đây là câu trả lời.")).toBeInTheDocument();

    const [, sendInit] = fetchMock.mock.calls[2];
    const body = JSON.parse((sendInit as RequestInit).body as string);
    expect(body).toEqual({ conversationId: created.id, message: "App này tính Band thế nào?", mode: "flash" });
  });

  it("auto-selects the most recent conversation and loads its messages", async () => {
    const conv1 = makeConversation({ id: "conv-1", title: "Cuộc 1" });
    const conv2 = makeConversation({ id: "conv-2", title: "Cuộc 2", mode: "pro" });
    mockFetchSequence([
      { json: [conv1, conv2] }, // mount: list, conv-1 is first -> auto-selected
      { json: { mode: "flash", messages: [{ id: "m1", role: "assistant", content: "Tin nhắn cũ của cuộc 1", createdAt: conv1.createdAt }] } },
    ]);

    render(<ChatWindow />);

    expect(await screen.findByText("Tin nhắn cũ của cuộc 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Cuộc trò chuyện")).toHaveValue("conv-1");
  });

  it("switching conversation via the dropdown loads that conversation's messages and mode", async () => {
    const user = userEvent.setup();
    const conv1 = makeConversation({ id: "conv-1", title: "Cuộc 1" });
    const conv2 = makeConversation({ id: "conv-2", title: "Cuộc 2", mode: "pro" });
    mockFetchSequence([
      { json: [conv1, conv2] },
      { json: { mode: "flash", messages: [] } }, // auto-selected conv-1
      { json: { mode: "pro", messages: [{ id: "m2", role: "assistant", content: "Tin nhắn của cuộc 2", createdAt: conv2.createdAt }] } },
    ]);

    render(<ChatWindow />);
    await screen.findByLabelText("Cuộc trò chuyện");

    await user.selectOptions(screen.getByLabelText("Cuộc trò chuyện"), "conv-2");

    expect(await screen.findByText("Tin nhắn của cuộc 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "✨ Pro" })).toHaveAttribute("aria-pressed", "true");
  });

  it("changing mode marks it active and persists it for the conversation", async () => {
    const user = userEvent.setup();
    const conv1 = makeConversation({ id: "conv-1" });
    const { fetchMock } = mockFetchSequence([
      { json: [conv1] },
      { json: { mode: "flash", messages: [] } },
      { json: { ...conv1, mode: "thinking" } }, // PATCH response
    ]);

    render(<ChatWindow />);
    await screen.findByLabelText("Cuộc trò chuyện");
    expect(screen.getByRole("button", { name: "⚡ Flash" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "🧠 Thinking" }));

    expect(screen.getByRole("button", { name: "🧠 Thinking" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "⚡ Flash" })).toHaveAttribute("aria-pressed", "false");

    const [patchUrl, patchInit] = fetchMock.mock.calls[2];
    expect(patchUrl).toBe(`/api/chat/conversations/${conv1.id}`);
    expect(JSON.parse((patchInit as RequestInit).body as string)).toEqual({ mode: "thinking" });
  });

  it("deletes the active conversation after confirmation and falls back to the empty state", async () => {
    const user = userEvent.setup();
    const conv1 = makeConversation({ id: "conv-1" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetchSequence([{ json: [conv1] }, { json: { mode: "flash", messages: [] } }, { json: { ok: true } }]);

    render(<ChatWindow />);
    await screen.findByLabelText("Cuộc trò chuyện");

    await user.click(screen.getByRole("button", { name: "Xóa cuộc trò chuyện" }));

    expect(await screen.findByText("Chưa có cuộc trò chuyện nào")).toBeInTheDocument();
  });

  it("does not send an empty/whitespace-only message", async () => {
    const user = userEvent.setup();
    const { fetchMock } = mockFetchSequence([{ json: [] }]);

    render(<ChatWindow />);
    await screen.findByText(/Chào bạn!/);
    await user.type(screen.getByLabelText("Nhập câu hỏi"), "   ");
    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial conversation-list fetch
  });

  it("shows a friendly error and keeps the typed exchange visible when the API fails", async () => {
    const user = userEvent.setup();
    const created = makeConversation();
    mockFetchSequence([
      { json: [] },
      { json: created },
      { status: 503, json: { error: "Chatbot chưa sẵn sàng — kiểm tra server AI (ai/server/) đã chạy chưa." } },
    ]);

    render(<ChatWindow />);
    await screen.findByText(/Chào bạn!/);
    await user.type(screen.getByLabelText("Nhập câu hỏi"), "Xin chào");
    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Chatbot chưa sẵn sàng");
    expect(screen.getByText("Xin chào")).toBeInTheDocument();
  });
});
