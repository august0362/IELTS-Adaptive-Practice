import { NextResponse } from "next/server";
import { getSkillStats } from "@/lib/db/queries";

/**
 * Per-skill stats for the `/stats/[skillCode]` page (PROJECT_CONTEXT.md
 * section 5.10) — see getSkillStats() in lib/db/queries.ts, shared with that
 * page's Server Component so both compute this identically.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ skillCode: string }> }) {
  const { skillCode } = await params;

  const stats = await getSkillStats(skillCode);
  if (!stats) {
    return NextResponse.json({ error: `Unknown skillCode: ${skillCode}` }, { status: 404 });
  }

  return NextResponse.json(stats);
}
