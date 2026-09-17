import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rollSessions } from "@/lib/db/schema";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "20");
  const offset = Number(searchParams.get("offset") ?? "0");

  const [{ total }] = await db.select({ total: count() }).from(rollSessions);

  const sessions = await db.query.rollSessions.findMany({
    orderBy: (session, { desc }) => [desc(session.rolledAt)],
    limit,
    offset,
    with: {
      results: {
        with: { skill: true, part: true },
      },
    },
  });

  const items = sessions.map((session) => ({
    id: session.id,
    rolledAt: session.rolledAt,
    results: session.results.map((r) => ({
      skill: { id: r.skill.id, code: r.skill.code, name: r.skill.name },
      part: { id: r.part.id, code: r.part.code, name: r.part.name },
    })),
  }));

  return NextResponse.json({ total, items });
}
