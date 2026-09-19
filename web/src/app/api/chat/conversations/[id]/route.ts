import { NextResponse } from "next/server";
import { deleteChatConversation, getChatConversationWithMessages, updateChatConversation } from "@/lib/db/queries";
import { readJsonObject } from "@/lib/api/requestJson";
import type { ChatConversationDetailDTO, ChatMode } from "@/lib/types";

const VALID_MODES: ChatMode[] = ["flash", "thinking", "pro"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await getChatConversationWithMessages(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const response: ChatConversationDetailDTO = {
    id: conversation.id,
    title: conversation.title,
    mode: conversation.mode,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
  return NextResponse.json(response);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { title, mode } = parsed.body;

  if (title === undefined && mode === undefined) {
    return NextResponse.json({ error: "title and/or mode required" }, { status: 400 });
  }
  if (mode !== undefined && !VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `mode must be one of ${VALID_MODES.join(", ")}` }, { status: 400 });
  }

  const patch: { title?: string; mode?: ChatMode } = {};
  if (typeof title === "string" && title.trim().length > 0) patch.title = title.trim();
  if (mode !== undefined) patch.mode = mode;

  const updated = await updateChatConversation(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    mode: updated.mode,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteChatConversation(id);
  if (!deleted) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
