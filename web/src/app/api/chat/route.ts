import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/requestJson";
import {
  addChatMessage,
  deriveChatTitle,
  getChatContextSummary,
  getChatConversationWithMessages,
  updateChatConversation,
} from "@/lib/db/queries";
import type { ChatMode, ChatSendResponse } from "@/lib/types";

// ai/server/ (Python/FastAPI) — a separate module, not part of this Next.js
// app. This route is the one thin bridge named in CLAUDE.md's AI/ML role:
// it reads web/'s own DB for context/history, then hands off to ai/ over
// plain HTTP. ai/ never touches this app's DB directly. See
// PROJECT_CONTEXT.md section 11.
const AI_SERVER_URL = process.env.AI_SERVER_URL ?? "http://127.0.0.1:8787";
// Measured live on the dev machine (RTX 3050 4GB) with Qwen3.5-4B: flash mode
// (thinking off) answers a RAG-grounded question in ~30-46s. "pro" mode
// (thinking on + more retrieved context, ai/server/main.py's MODE_SETTINGS)
// hit an actual httpx.ReadTimeout on ai/server/'s side at ~122s during
// testing — must stay >= ai/server/ollama_client.py's own CHAT_TIMEOUT (300s)
// or web/ aborts the request before ai/server/ has a chance to time out (or
// succeed) itself.
const AI_SERVER_TIMEOUT_MS = 300_000;
const VALID_MODES: ChatMode[] = ["flash", "thinking", "pro"];

export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { conversationId, message, mode } = parsed.body;

  if (typeof conversationId !== "string" || conversationId.length === 0) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (mode !== undefined && !VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `mode must be one of ${VALID_MODES.join(", ")}` }, { status: 400 });
  }

  const conversation = await getChatConversationWithMessages(conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const effectiveMode: ChatMode = mode ?? conversation.mode;
  if (mode !== undefined && mode !== conversation.mode) {
    await updateChatConversation(conversationId, { mode });
  }

  // History is the server's own record, not whatever the client last had in
  // memory — the whole point of persisting conversations (vs the Milestone 6
  // version, which trusted a client-sent `history` array) is that switching
  // between the bubble/full page or reloading never loses or desyncs it.
  const isFirstMessage = conversation.messages.length === 0;
  const history = conversation.messages.map((m) => ({ role: m.role, content: m.content }));

  await addChatMessage(conversationId, "user", message);
  if (isFirstMessage) {
    await updateChatConversation(conversationId, { title: deriveChatTitle(message) });
  }

  const dbContext = await getChatContextSummary();

  let aiResponse: Response;
  try {
    aiResponse = await fetch(`${AI_SERVER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, dbContext, mode: effectiveMode }),
      signal: AbortSignal.timeout(AI_SERVER_TIMEOUT_MS),
    });
  } catch {
    // ai/server/ not running, unreachable, or timed out — a real, expected state
    // (it's a separate process the user starts on its own) rather than a bug in
    // this route, so this is a friendly 503, not an unhandled 500. The user's
    // message is already saved above, so it isn't lost even though no reply
    // comes back this time.
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

  await addChatMessage(conversationId, "assistant", data.reply);

  const response: ChatSendResponse = { reply: data.reply, conversationId };
  return NextResponse.json(response);
}
