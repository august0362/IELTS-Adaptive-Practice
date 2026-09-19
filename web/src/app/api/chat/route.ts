import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/requestJson";
import { getChatContextSummary } from "@/lib/db/queries";
import type { ChatMessage, ChatResponse } from "@/lib/types";

// ai/server/ (Python/FastAPI) — a separate module, not part of this Next.js
// app. This route is the one thin bridge named in CLAUDE.md's AI/ML role:
// it reads web/'s own DB for context, then hands off to ai/ over plain HTTP.
// ai/ never touches this app's DB directly. See PROJECT_CONTEXT.md section 11.
const AI_SERVER_URL = process.env.AI_SERVER_URL ?? "http://127.0.0.1:8787";
// Measured live on the dev machine (RTX 3050 4GB) with Qwen3.5-4B, thinking
// mode off (see ai/server/ollama_client.py): a real RAG-grounded answer took
// ~46s (prompt includes several retrieved doc chunks + the model has to load
// weights on a cold start). 60s cut that too close — matches
// ai/server/ollama_client.py's own REQUEST_TIMEOUT so neither side times out
// first.
const AI_SERVER_TIMEOUT_MS = 120_000;

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    )
  );
}

export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { message, history } = parsed.body;

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (history !== undefined && !isChatMessageArray(history)) {
    return NextResponse.json({ error: "history must be an array of {role, content}" }, { status: 400 });
  }

  const dbContext = await getChatContextSummary();

  let aiResponse: Response;
  try {
    aiResponse = await fetch(`${AI_SERVER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: history ?? [], dbContext }),
      signal: AbortSignal.timeout(AI_SERVER_TIMEOUT_MS),
    });
  } catch {
    // ai/server/ not running, unreachable, or timed out — a real, expected state
    // (it's a separate process the user starts on its own) rather than a bug in
    // this route, so this is a friendly 503, not an unhandled 500.
    return NextResponse.json(
      { error: "Chatbot chưa sẵn sàng — kiểm tra server AI (ai/server/) đã chạy chưa." },
      { status: 503 }
    );
  }

  if (!aiResponse.ok) {
    return NextResponse.json({ error: "Chatbot gặp lỗi khi xử lý câu hỏi." }, { status: 502 });
  }

  const data = await aiResponse.json();
  if (typeof data?.reply !== "string") {
    return NextResponse.json({ error: "Phản hồi từ chatbot không hợp lệ." }, { status: 502 });
  }

  const response: ChatResponse = { reply: data.reply };
  return NextResponse.json(response);
}
