export type PickCardState = "idle" | "cycling" | "selected" | "dimmed";

interface PickCardProps {
  name: string;
  probabilityPercent: number;
  state: PickCardState;
}

const STATE_CLASSES: Record<PickCardState, string> = {
  idle: "surface-glow border-border bg-surface text-surface-foreground",
  cycling: "border-blue-400 bg-blue-50 text-blue-900 scale-105 shadow-md",
  selected: "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md",
  // Deliberately no `.surface-glow` here: "dimmed" is meant to read as faded/
  // washed out toward the page (the card that *wasn't* picked), so both its
  // background and text already fade toward transparency together via the
  // same /50 and /40 opacity — adding a glow would fight that fade instead of
  // reinforcing it.
  dimmed: "border-border/50 bg-surface/50 text-surface-foreground/40",
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
