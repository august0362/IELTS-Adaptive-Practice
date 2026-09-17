interface RoundingModeToggleProps {
  mode: string;
  onChange: (mode: "per_skill_rounded" | "raw_average") => void;
  isSaving: boolean;
}

const OPTIONS: { value: "per_skill_rounded" | "raw_average"; label: string }[] = [
  { value: "per_skill_rounded", label: "Làm tròn từng kỹ năng trước" },
  { value: "raw_average", label: "Tính trung bình rồi làm tròn 1 lần" },
];

export function RoundingModeToggle({ mode, onChange, isSaving }: RoundingModeToggleProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <span className="text-sm font-medium text-foreground/70">Cách tính Band tổng dự đoán</span>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-3">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="rounding-mode"
              value={opt.value}
              checked={mode === opt.value}
              disabled={isSaving}
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
