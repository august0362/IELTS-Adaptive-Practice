import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cambridgeTestResults } from "@/lib/db/schema";
import { ieltsRound } from "@/lib/engine/ieltsRounding";

const DEFAULT_RECENT_LIMIT = 5;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";
  const limit = all ? undefined : Number(searchParams.get("limit") ?? String(DEFAULT_RECENT_LIMIT));

  const query = db.select().from(cambridgeTestResults).orderBy(desc(cambridgeTestResults.testDate));
  const results = limit ? await query.limit(limit) : await query;

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { testDate, testName, readingBand, listeningBand, writingBand, speakingBand, note } = body ?? {};

  const bands = { readingBand, listeningBand, writingBand, speakingBand };
  for (const [key, value] of Object.entries(bands)) {
    if (typeof value !== "number" || value < 0 || value > 9) {
      return NextResponse.json({ error: `${key} must be a number between 0 and 9` }, { status: 400 });
    }
  }
  if (!testDate || typeof testName !== "string" || testName.length === 0) {
    return NextResponse.json({ error: "testDate and testName are required" }, { status: 400 });
  }

  const overallBand = ieltsRound((readingBand + listeningBand + writingBand + speakingBand) / 4);

  const [created] = await db
    .insert(cambridgeTestResults)
    .values({
      testDate: new Date(testDate),
      testName,
      readingBand,
      listeningBand,
      writingBand,
      speakingBand,
      overallBand,
      note: typeof note === "string" ? note : null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
