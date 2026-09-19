import { NextResponse } from "next/server";
import { createChatConversation, getChatConversations } from "@/lib/db/queries";
import type { ChatConversationListItemDTO } from "@/lib/types";

export async function GET() {
  const conversations = await getChatConversations();
  const response: ChatConversationListItemDTO[] = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    mode: c.mode,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    lastMessagePreview: c.lastMessagePreview,
  }));
  return NextResponse.json(response);
}

export async function POST() {
  const created = await createChatConversation();
  return NextResponse.json(
    {
      id: created.id,
      title: created.title,
      mode: created.mode,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
