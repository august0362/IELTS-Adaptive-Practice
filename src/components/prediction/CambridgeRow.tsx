import type { CambridgeTestDTO } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface CambridgeRowProps {
  result: CambridgeTestDTO;
  onEdit: () => void;
  onDelete: () => void;
}

export function CambridgeRow({ result, onEdit, onDelete }: CambridgeRowProps) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{result.testName}</span>
        <span className="text-xs text-foreground/50">{formatDate(result.testDate)}</span>
        {result.note && <span className="text-xs italic text-foreground/50">{result.note}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span>R {result.readingBand}</span>
        <span>L {result.listeningBand}</span>
        <span>W {result.writingBand}</span>
        <span>S {result.speakingBand}</span>
        <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Overall {result.overallBand}
        </span>
      </div>

      <div className="flex gap-2 self-end sm:self-auto">
        <button type="button" onClick={onEdit} className="text-xs font-medium text-foreground/60 hover:text-foreground hover:underline">
          Sửa
        </button>
        <button type="button" onClick={onDelete} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
          Xóa
        </button>
      </div>
    </li>
  );
}
