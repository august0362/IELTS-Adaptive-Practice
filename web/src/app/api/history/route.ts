import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rollSessions } from "@/lib/db/schema";
import { getRecentRollHistory } from "@/lib/db/queries";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

function parseNonNegativeInt(raw: string | null, fallback: number, max?: number): number {
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  const truncated = Math.trunc(parsed);
  return max !== undefined ? Math.min(truncated, max) : truncated;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseNonNegativeInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parseNonNegativeInt(searchParams.get("offset"), 0);

  const [{ total }] = await db.select({ total: count() }).from(rollSessions);
  const sessions = await getRecentRollHistory(limit, offset);

  const items = sessions.map((session) => ({
    id: session.id,
    rolledAt: session.rolledAt,
    source: session.source,
    results: session.results.map((r) => ({
      id: r.id,
      skill: { id: r.skill.id, code: r.skill.code, name: r.skill.name },
      part: { id: r.part.id, code: r.part.code, name: r.part.name },
      questionTypes: r.questionTypes.map((rqt) => ({
        id: rqt.questionType.id,
        code: rqt.questionType.code,
        name: rqt.questionType.name,
      })),
      questionsAnswered: r.questionsAnswered,
      questionsCorrect: r.questionsCorrect,
    })),
  }));

  return NextResponse.json({ total, items });
}
