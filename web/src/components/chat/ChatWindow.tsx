"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatConversationListItemDTO, ChatMessageDTO, ChatMode, ChatSendResponse } from "@/lib/types";

const MODE_LABELS: Record<ChatMode, string> = {
  flash: "⚡ Flash",
  thinking: "🧠 Thinking",
  pro: "✨ Pro",
};

const MODE_ORDER: ChatMode[] = ["flash", "thinking", "pro"];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `Request to ${url} failed with ${res.status}`);
  }
  return data as T;
}

let pendingIdCounter = 0;
/** Local-only id for an optimistically-rendered message before the server
 * round-trip resolves — never sent anywhere, just a React key. */
function nextPendingId() {
  pendingIdCounter += 1;
  return `pending-${pendingIdCounter}`;
}

/** `compact` is used inside the floating bubble popup (ChatBubble.tsx) —
 * same component, same logic, just tighter spacing and no page heading (the
 * bubble already has its own small header with the "Navita" name on it). */
export function ChatWindow({ compact = false }: { compact?: boolean }) {
  const [conversations, setConversations] = useState<ChatConversationListItemDTO[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("flash");
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Always holds the latest activeId, readable from inside an in-flight
  // handleSend's async continuation — `activeId` itself is a stale closure
  // value there (captured at the render handleSend was called from), which
  // is exactly how a real bug shipped: switching conversations (or deleting
  // the one just sent to) while a slow Thinking/Pro reply was still in
  // flight made the eventual reply append to whatever conversation was *now*
  // showing, and silently forced the user back to the original one. Every
  // post-await state update below checks this ref, not the `activeId`
  // variable, before touching `messages`/`errorMessage`.
  //
  // Kept in sync via setActiveIdAndRef() below, NOT a useEffect keyed on
  // activeId — a first attempt did that and had its own real bug: handleSend
  // both creates a conversation (setActiveId) *and* needs activeIdRef to
  // already reflect it a few lines later in the same call, with no
  // intervening render/effect-flush guaranteed to have happened by then.
  const activeIdRef = useRef<string | null>(null);
  function setActiveIdAndRef(id: string | null) {
    activeIdRef.current = id;
    setActiveId(id);
  }
  // Guards handleSend against a double-send race (e.g. a fast double-click,
  // or Enter pressed twice before the first render with isSending=true
  // lands) — a plain ref so the check is synchronous and independent of
  // React's render timing, unlike reading the `isSending` state directly.
  const isSendingRef = useRef(false);
  // Set right before setActiveIdAndRef(newlyCreatedId) so the message-loading effect
  // below skips its GET for that one transition — a conversation we just
  // created ourselves has no messages on the server yet, and letting that
  // effect's fetch land, with `messages: []` for a freshly created
  // conversation, would race with (and can arrive after) the optimistic
  // message handleSend adds locally, silently wiping it back to empty. Only
  // switching to an *existing* conversation (dropdown, initial mount) should
  // ever trigger that fetch.
  const skipNextMessageFetchForIdRef = useRef<string | null>(null);

  // Refreshes titles/preview/ordering after a send — deliberately never
  // touches `activeId`. An earlier version passed the just-answered
  // conversation's id and always re-selected it, which forced the user back
  // to that conversation even if they'd since switched to another one while
  // the (possibly minutes-long) reply was still in flight — a real bug found
  // in review, not a hypothetical.
  const refreshConversations = useCallback(async () => {
    try {
      const list = await fetchJson<ChatConversationListItemDTO[]>("/api/chat/conversations");
      setConversations(list);
    } catch {
      setErrorMessage("Không tải được danh sách cuộc trò chuyện.");
    }
  }, []);

  // Initial mount only — deliberately not just `loadConversations()` here:
  // the lint rule wants the effect's own body to own its setState calls
  // (inside a promise callback), not delegate to a separately-defined
  // function that does so.
  useEffect(() => {
    let cancelled = false;
    fetchJson<ChatConversationListItemDTO[]>("/api/chat/conversations")
      .then((list) => {
        if (cancelled) return;
        setConversations(list);
        if (list[0]) setActiveIdAndRef(list[0].id);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage("Không tải được danh sách cuộc trò chuyện.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    if (skipNextMessageFetchForIdRef.current === activeId) {
      skipNextMessageFetchForIdRef.current = null;
      return;
    }
    let cancelled = false;
    fetchJson<{ mode: ChatMode; messages: ChatMessageDTO[] }>(`/api/chat/conversations/${activeId}`)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setMode(data.mode);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage("Không tải được cuộc trò chuyện.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    // jsdom (component tests) doesn't implement scrollIntoView at all — guard
    // rather than crash the effect in that environment.
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  async function handleNewConversation() {
    try {
      const created = await fetchJson<ChatConversationListItemDTO>("/api/chat/conversations", { method: "POST" });
      skipNextMessageFetchForIdRef.current = created.id;
      setConversations((prev) => [{ ...created, lastMessagePreview: null }, ...prev]);
      setActiveIdAndRef(created.id);
      setMode(created.mode);
      setMessages([]);
      setErrorMessage(null);
    } catch {
      setErrorMessage("Không tạo được cuộc trò chuyện mới.");
    }
  }

  async function handleDeleteConversation() {
    if (!activeId) return;
    if (!window.confirm("Xóa cuộc trò chuyện này?")) return;
    try {
      await fetchJson(`/api/chat/conversations/${activeId}`, { method: "DELETE" });
      const remaining = conversations.filter((c) => c.id !== activeId);
      setConversations(remaining);
      setMessages([]);
      setActiveIdAndRef(remaining[0]?.id ?? null);
    } catch {
      setErrorMessage("Xóa cuộc trò chuyện thất bại.");
    }
  }

  async function handleModeChange(newMode: ChatMode) {
    setMode(newMode);
    if (!activeId) return;
    try {
      await fetchJson(`/api/chat/conversations/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
    } catch {
      // Non-fatal — the next message send passes `mode` explicitly regardless,
      // so a failed persist here doesn't break the current turn, only the
      // "remembered for next time" part of it.
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (trimmed.length === 0 || isSendingRef.current) return;
    isSendingRef.current = true;
    setIsSending(true);
    setErrorMessage(null);

    let conversationId = activeId;
    if (!conversationId) {
      try {
        const created = await fetchJson<ChatConversationListItemDTO>("/api/chat/conversations", { method: "POST" });
        conversationId = created.id;
        skipNextMessageFetchForIdRef.current = created.id;
        setConversations((prev) => [{ ...created, lastMessagePreview: null }, ...prev]);
        setActiveIdAndRef(created.id);
      } catch {
        setErrorMessage("Không tạo được cuộc trò chuyện mới.");
        isSendingRef.current = false;
        setIsSending(false);
        return;
      }
    }

    setMessages((prev) => [...prev, { id: nextPendingId(), role: "user", content: trimmed, createdAt: new Date().toISOString() }]);
    setInput("");

    try {
      const { reply } = await fetchJson<ChatSendResponse>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: trimmed, mode }),
      });
      // Only touch the visible message list if still looking at this same
      // conversation — a Thinking/Pro reply can take minutes, long enough to
      // switch away (or delete it) in the meantime. See activeIdRef's comment.
      if (activeIdRef.current === conversationId) {
        setMessages((prev) => [...prev, { id: nextPendingId(), role: "assistant", content: reply, createdAt: new Date().toISOString() }]);
      }
      refreshConversations();
    } catch (err) {
      if (activeIdRef.current === conversationId) {
        setErrorMessage(err instanceof Error ? err.message : "Có lỗi xảy ra, thử lại sau.");
      }
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className={`mx-auto flex min-h-0 w-full flex-1 flex-col gap-4 px-4 ${compact ? "py-3" : "max-w-3xl py-10"}`}>
      {!compact && (
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Navita</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Hỏi đáp về app, kiến thức IELTS, hoặc tư vấn luyện tập dựa trên dữ liệu của bạn.
          </p>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <section className="surface-glow flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <label htmlFor="chat-conversation" className="sr-only">
            Cuộc trò chuyện
          </label>
          {/* Disabled while sending — not just tidiness: switching or deleting the
              conversation a slow Thinking/Pro reply is about to land in was a real,
              easily-reproduced bug (see activeIdRef's comment and route.ts's
              addChatMessage try/catch, which stay as defense-in-depth regardless). */}
          <select
            id="chat-conversation"
            value={activeId ?? ""}
            onChange={(e) => setActiveIdAndRef(e.target.value || null)}
            disabled={isSending}
            className="input-paper min-w-0 flex-1 px-2 py-1 text-sm disabled:opacity-60"
          >
            {conversations.length === 0 && <option value="">Chưa có cuộc trò chuyện nào</option>}
            {conversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={isSending}
            title="Cuộc trò chuyện mới"
            aria-label="Cuộc trò chuyện mới"
            className="shrink-0 rounded-full border border-border px-3 py-1 text-sm font-medium text-surface-foreground hover:bg-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
          {activeId && (
            <button
              type="button"
              onClick={handleDeleteConversation}
              disabled={isSending}
              title="Xóa cuộc trò chuyện"
              aria-label="Xóa cuộc trò chuyện"
              className="shrink-0 rounded-full border border-border px-3 py-1 text-sm font-medium text-surface-foreground hover:bg-border disabled:cursor-not-allowed disabled:opacity-40"
            >
              🗑
            </button>
          )}
        </div>

        <ul className="flex flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
          {messages.length === 0 && (
            <li className="max-w-[85%] self-start rounded-2xl bg-border px-4 py-2 text-sm text-surface-foreground">
              Chào bạn! Mình là Navita — hỏi mình về cách dùng app, kiến thức IELTS, hoặc nhờ tư vấn dựa trên lịch sử luyện tập của bạn nhé.
            </li>
          )}
          {messages.map((m) => (
            <li
              key={m.id}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-border text-surface-foreground"
              }`}
            >
              {m.content}
            </li>
          ))}
          {isSending && (
            <li className="self-start rounded-2xl bg-border px-4 py-2 text-sm text-surface-foreground/60">
              Đang trả lời... (model chạy trên máy bạn — Flash thường ~30–45 giây, Thinking/Pro có thể mất vài phút vì suy nghĩ kỹ hơn)
            </li>
          )}
          <div ref={bottomRef} />
        </ul>

        <div className="flex flex-wrap gap-1.5">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              aria-pressed={mode === m}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                mode === m ? "bg-primary text-primary-foreground" : "bg-border text-surface-foreground/70"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Nhập câu hỏi
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Nhập câu hỏi... (Enter để gửi, Shift+Enter xuống dòng)"
            className="input-paper w-full resize-none px-3 py-2 text-sm placeholder:text-input-foreground/50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || input.trim().length === 0}
            className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Gửi
          </button>
        </div>
      </section>
    </div>
  );
}
