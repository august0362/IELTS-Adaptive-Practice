import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  // Regression tests for 2 real bugs a Milestone-6-extension review caught:
  // switching/deleting the active conversation while a slow Thinking/Pro
  // reply (measured up to ~4 minutes live) was still in flight leaked the
  // eventual reply into whatever conversation was *now* showing and forced
  // the user back to the original one; and a fast double-send created 2
  // conversations for 1 typed message. Both need to control exactly when the
  // POST /api/chat call resolves, which mockFetchSequence (immediate,
  // in-order) can't express — hence the manual deferred-promise mock below.
  it("disables switching/creating/deleting a conversation while a reply is pending, and re-enables once it resolves", async () => {
    const user = userEvent.setup();
    const conv1 = makeConversation({ id: "conv-1" });
    let resolveSend: (value: { reply: string; conversationId: string }) => void = () => {};
    const sendPromise = new Promise<{ reply: string; conversationId: string }>((resolve) => {
      resolveSend = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "/api/chat/conversations" && !init) {
          return { ok: true, status: 200, json: async () => [conv1] } as Response;
        }
        if (url === `/api/chat/conversations/${conv1.id}`) {
          return { ok: true, status: 200, json: async () => ({ mode: "flash", messages: [] }) } as Response;
        }
        if (url === "/api/chat") {
          const body = await sendPromise;
          return { ok: true, status: 200, json: async () => body } as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );

    render(<ChatWindow />);
    await screen.findByLabelText("Cuộc trò chuyện");

    await user.type(screen.getByLabelText("Nhập câu hỏi"), "Câu hỏi chậm");
    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(screen.getByLabelText("Cuộc trò chuyện")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cuộc trò chuyện mới" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xóa cuộc trò chuyện" })).toBeDisabled();

    resolveSend({ reply: "Trả lời cuối cùng", conversationId: conv1.id });

    expect(await screen.findByText("Trả lời cuối cùng")).toBeInTheDocument();
    expect(screen.getByLabelText("Cuộc trò chuyện")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Cuộc trò chuyện mới" })).not.toBeDisabled();
  });

  it("does not send a second request while the first is still awaiting a reply", async () => {
    const user = userEvent.setup();
    let chatCallCount = 0;
    let resolveSend: (value: { reply: string; conversationId: string }) => void = () => {};
    const sendPromise = new Promise<{ reply: string; conversationId: string }>((resolve) => {
      resolveSend = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "/api/chat/conversations" && init?.method === "POST") {
          return { ok: true, status: 201, json: async () => makeConversation() } as Response;
        }
        if (url === "/api/chat/conversations") {
          return { ok: true, status: 200, json: async () => [] } as Response;
        }
        if (url === "/api/chat") {
          chatCallCount += 1;
          const body = await sendPromise;
          return { ok: true, status: 200, json: async () => body } as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );

    render(<ChatWindow />);
    await screen.findByText(/Chào bạn!/);

    await user.type(screen.getByLabelText("Nhập câu hỏi"), "Gửi nhanh 2 lần");
    const sendButton = screen.getByRole("button", { name: "Gửi" });
    // Two synchronous fireEvent.click calls, deliberately not awaited between
    // them — this is the actual race window the bug lived in: the 2nd click
    // lands before React has re-rendered with isSending=true (which is what
    // disables the button), while the 1st click's handleSend is already
    // paused mid-flight (awaiting the conversation-creation round-trip). Only
    // a synchronous ref set *before* that first await — not the isSending
    // state — can catch this; userEvent.click would wait out each click's
    // React update in between and never reproduce the race at all.
    fireEvent.click(sendButton);
    fireEvent.click(sendButton);

    resolveSend({ reply: "ok", conversationId: "whatever" });
    await screen.findByText("ok");

    expect(chatCallCount).toBe(1);
  });
});
