import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { topics } from "@/lib/db/schema";
import { readJsonObject } from "@/lib/api/requestJson";

export async function GET() {
  const rows = await db.select().from(topics).orderBy(desc(topics.createdAt));
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { name } = parsed.body;
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name (non-empty string) is required" }, { status: 400 });
  }

  const [created] = await db.insert(topics).values({ name: name.trim() }).returning();
  return NextResponse.json(created, { status: 201 });
}
