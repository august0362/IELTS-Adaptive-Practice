import { notFound } from "next/navigation";
import Link from "next/link";
import { getSkillStats } from "@/lib/db/queries";
import { PracticeLog } from "@/components/stats/PracticeLog";
import { QuestionTypeBarChart } from "@/components/stats/QuestionTypeBarChart";
import { QuestionTypeRadarChart } from "@/components/stats/QuestionTypeRadarChart";

// Live DB read on every request — see src/app/page.tsx's identical comment.
export const dynamic = "force-dynamic";

const SKILL_COLOR_VAR: Record<string, string> = {
  READING: "var(--chart-reading)",
  LISTENING: "var(--chart-listening)",
  WRITING: "var(--chart-writing)",
  SPEAKING: "var(--chart-speaking)",
};

export default async function SkillStatsPage({ params }: { params: Promise<{ skillCode: string }> }) {
  const { skillCode } = await params;
  const stats = await getSkillStats(skillCode.toUpperCase());
  if (!stats) notFound();

  const practiceLog = stats.practiceLog.map((entry) => ({
    ...entry,
    rolledAt: entry.rolledAt.toISOString(),
  }));

  const color = SKILL_COLOR_VAR[stats.skill.code] ?? "var(--primary)";
  const countData = stats.questionTypeStats?.map((t) => ({ name: t.name, value: t.count })) ?? [];
  const percentData = stats.questionTypeStats?.map((t) => ({ name: t.name, value: t.percentage })) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Thống kê — {stats.skill.name}</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {practiceLog.length} lần luyện ghi nhận (cả quay và tự học).
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-primary hover:opacity-80">
          ← Vòng quay
        </Link>
      </div>

      {stats.questionTypeStats === null ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground/60">
          {stats.skill.name} không có dạng bài để thống kê.
        </p>
      ) : stats.questionTypeStats.every((t) => t.count === 0) ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground/60">
          Chưa có lượt nào random ra dạng bài để thống kê.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-foreground/70">Số lần theo dạng bài</h2>
            <QuestionTypeBarChart data={countData} color={color} unit="lần" />
          </section>

          <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-foreground/70">Tỉ lệ % theo dạng bài</h2>
            <QuestionTypeBarChart data={percentData} color={color} unit="%" />
          </section>

          <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-foreground/70">Cân bằng dạng bài</h2>
            <QuestionTypeRadarChart data={percentData} color={color} />
          </section>
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground/70">Lịch sử luyện</h2>
        <PracticeLog entries={practiceLog} />
      </section>
    </main>
  );
}
