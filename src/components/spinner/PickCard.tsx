export type PickCardState = "idle" | "cycling" | "selected" | "dimmed";

interface PickCardProps {
  name: string;
  probabilityPercent: number;
  state: PickCardState;
}

const STATE_CLASSES: Record<PickCardState, string> = {
  idle: "border-black/10 bg-white text-foreground dark:border-white/10 dark:bg-white/5",
  cycling: "border-blue-400 bg-blue-50 text-blue-900 scale-105 shadow-md dark:border-blue-500 dark:bg-blue-950 dark:text-blue-100",
  selected: "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-100",
  dimmed: "border-black/5 bg-white/50 text-foreground/40 dark:border-white/5 dark:bg-white/5 dark:text-foreground/30",
};

export function PickCard({ name, probabilityPercent, state }: PickCardProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-5 text-center transition-all duration-150 ${STATE_CLASSES[state]}`}
    >
      <span className="text-sm font-semibold">{name}</span>
      <span className="text-xs opacity-70">{probabilityPercent.toFixed(0)}%</span>
    </div>
  );
}
