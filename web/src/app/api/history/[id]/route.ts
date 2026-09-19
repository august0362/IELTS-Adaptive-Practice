import { NextResponse } from "next/server";
import { eq, and, ne, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  rollSessions,
  rollResults,
  rollResultQuestionTypes,
  skills,
  skillParts,
  questionTypes,
} from "@/lib/db/schema";

/**
 * Deletes a roll (or manual-practice, source = "manual") session and reverts
 * every counter effect it had: decrements the skill/part/question-type rows
 * it bumped (floored at 0) and recomputes each one's lastAppearedAt from
 * whatever roll history remains, rather than just leaving the stale timestamp.
 *
 * Known limitation (documented, not a bug to "fix" later without discussion):
 * if a count-soft-reset (PROJECT_CONTEXT.md 5.2.1) happened *after* this roll,
 * the decrement below is best-effort against the already-halved counters —
 * exact reconstruction isn't possible once history has been rescaled. This
 * only matters after 50+ occurrences of the same pool, so it's an accepted
 * edge case rather than a blocker.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const outcome = db.transaction((tx) => {
    const [session] = tx.select().from(rollSessions).where(eq(rollSessions.id, id)).all();
    if (!session) return null;

    const results = tx.select().from(rollResults).where(eq(rollResults.rollSessionId, id)).all();

    function decrementSkill(skillId: string) {
      const [row] = tx.select().from(skills).where(eq(skills.id, skillId)).all();
      if (!row) return;
      tx.update(skills).set({ occurrenceCount: Math.max(0, row.occurrenceCount - 1) }).where(eq(skills.id, skillId)).run();

      const [latest] = tx
        .select({ rolledAt: rollSessions.rolledAt })
        .from(rollResults)
        .innerJoin(rollSessions, eq(rollResults.rollSessionId, rollSessions.id))
        .where(and(eq(rollResults.skillId, skillId), ne(rollSessions.id, id)))
        .orderBy(desc(rollSessions.rolledAt))
        .limit(1)
        .all();
      tx.update(skills).set({ lastAppearedAt: latest?.rolledAt ?? null }).where(eq(skills.id, skillId)).run();
    }

    function decrementPart(partId: string) {
      const [row] = tx.select().from(skillParts).where(eq(skillParts.id, partId)).all();
      if (!row) return;
      tx.update(skillParts)
        .set({ occurrenceCount: Math.max(0, row.occurrenceCount - 1) })
        .where(eq(skillParts.id, partId))
        .run();

      const [latest] = tx
        .select({ rolledAt: rollSessions.rolledAt })
        .from(rollResults)
        .innerJoin(rollSessions, eq(rollResults.rollSessionId, rollSessions.id))
        .where(and(eq(rollResults.skillPartId, partId), ne(rollSessions.id, id)))
        .orderBy(desc(rollSessions.rolledAt))
        .limit(1)
        .all();
      tx.update(skillParts).set({ lastAppearedAt: latest?.rolledAt ?? null }).where(eq(skillParts.id, partId)).run();
    }

    function decrementQuestionType(typeId: string) {
      const [row] = tx.select().from(questionTypes).where(eq(questionTypes.id, typeId)).all();
      if (!row) return;
      tx.update(questionTypes)
        .set({ occurrenceCount: Math.max(0, row.occurrenceCount - 1) })
        .where(eq(questionTypes.id, typeId))
        .run();

      const [latest] = tx
        .select({ rolledAt: rollSessions.rolledAt })
        .from(rollResultQuestionTypes)
        .innerJoin(rollResults, eq(rollResultQuestionTypes.rollResultId, rollResults.id))
        .innerJoin(rollSessions, eq(rollResults.rollSessionId, rollSessions.id))
        .where(and(eq(rollResultQuestionTypes.questionTypeId, typeId), ne(rollSessions.id, id)))
        .orderBy(desc(rollSessions.rolledAt))
        .limit(1)
        .all();
      tx.update(questionTypes)
        .set({ lastAppearedAt: latest?.rolledAt ?? null })
        .where(eq(questionTypes.id, typeId))
        .run();
    }

    for (const result of results) {
      decrementSkill(result.skillId);
      decrementPart(result.skillPartId);

      const types = tx
        .select()
        .from(rollResultQuestionTypes)
        .where(eq(rollResultQuestionTypes.rollResultId, result.id))
        .all();
      for (const type of types) {
        decrementQuestionType(type.questionTypeId);
      }

      tx.delete(rollResultQuestionTypes).where(eq(rollResultQuestionTypes.rollResultId, result.id)).run();
    }

    tx.delete(rollResults).where(eq(rollResults.rollSessionId, id)).run();
    tx.delete(rollSessions).where(eq(rollSessions.id, id)).run();

    return { ok: true as const };
  });

  if (!outcome) {
    return NextResponse.json({ error: "Roll session not found" }, { status: 404 });
  }
  return NextResponse.json(outcome);
}
