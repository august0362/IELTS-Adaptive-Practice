import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { skills, skillParts, questionTypes, rollResults, rollResultQuestionTypes, rollSessions } from "@/lib/db/schema";

/**
 * Per-skill stats for the `/stats/[skillCode]` page (PROJECT_CONTEXT.md
 * section 5.10): every day this skill was practiced (rolled or manually
 * logged) plus, for skills that have question types (everything but
 * Speaking), a count + percentage breakdown per type for the bar/radar
 * charts.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ skillCode: string }> }) {
  const { skillCode } = await params;

  const [skill] = await db.select().from(skills).where(eq(skills.code, skillCode));
  if (!skill) {
    return NextResponse.json({ error: `Unknown skillCode: ${skillCode}` }, { status: 404 });
  }

  const practiceRows = await db
    .select({
      rolledAt: rollSessions.rolledAt,
      source: rollSessions.source,
      partCode: skillParts.code,
      partName: skillParts.name,
    })
    .from(rollResults)
    .innerJoin(rollSessions, eq(rollResults.rollSessionId, rollSessions.id))
    .innerJoin(skillParts, eq(rollResults.skillPartId, skillParts.id))
    .where(eq(rollResults.skillId, skill.id))
    .orderBy(desc(rollSessions.rolledAt));

  const practiceLog = practiceRows.map((row) => ({
    rolledAt: row.rolledAt,
    source: row.source,
    part: { code: row.partCode, name: row.partName },
  }));

  const types = await db.select().from(questionTypes).where(eq(questionTypes.skillId, skill.id));

  let questionTypeStats: { code: string; name: string; count: number; percentage: number }[] | null = null;
  if (types.length > 0) {
    const counted = await Promise.all(
      types.map(async (type) => {
        const rows = await db
          .select({ id: rollResultQuestionTypes.id })
          .from(rollResultQuestionTypes)
          .where(eq(rollResultQuestionTypes.questionTypeId, type.id));
        return { type, count: rows.length };
      })
    );
    const total = counted.reduce((sum, c) => sum + c.count, 0);
    questionTypeStats = counted.map(({ type, count }) => ({
      code: type.code,
      name: type.name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));
  }

  return NextResponse.json({
    skill: { id: skill.id, code: skill.code, name: skill.name },
    practiceLog,
    questionTypeStats,
  });
}
