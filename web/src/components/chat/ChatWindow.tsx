"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage, ChatResponse } from "@/lib/types";

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Chào bạn! Mình là chatbot của app luyện thi IELTS này — hỏi mình về cách dùng app, kiến thức IELTS, hoặc nhờ tư vấn dựa trên lịch sử luyện tập của bạn nhé.",
};

async function postChat(message: string, history: ChatMessage[]): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Có lỗi xảy ra, thử lại sau.");
  }
  return data as ChatResponse;
}

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // jsdom (component tests) doesn't implement scrollIntoView at all — guard
    // rather than crash the effect in that environment.
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (trimmed.length === 0 || isSending) return;

    // History sent to the API is everything before this new turn (the welcome
    // message included is harmless context, not something the model needs to
    // literally repeat).
    const historyForRequest = messages;
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    setErrorMessage(null);

    try {
      const { reply } = await postChat(trimmed, historyForRequest);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Có lỗi xảy ra, thử lại sau.");
    } finally {
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Chatbot</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Hỏi đáp về app, kiến thức IELTS, hoặc tư vấn luyện tập dựa trên dữ liệu của bạn.
        </p>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <section className="surface-glow flex min-h-[24rem] flex-1 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <ul className="flex flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
          {messages.map((m, i) => (
            <li
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-border text-surface-foreground"
              }`}
            >
              {m.content}
            </li>
          ))}
          {isSending && (
            <li className="self-start rounded-2xl bg-border px-4 py-2 text-sm text-surface-foreground/60">
              Đang trả lời... (model chạy trên máy bạn nên có thể mất khoảng 1 phút, tùy độ dài câu hỏi)
            </li>
          )}
          <div ref={bottomRef} />
        </ul>

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
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Gửi
          </button>
        </div>
      </section>
    </main>
  );
}
