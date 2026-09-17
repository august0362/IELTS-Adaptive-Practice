import type { NoteDTO } from "@/lib/types";
import { parseTagsString } from "@/lib/tagUtils";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface NoteCardProps {
  note: NoteDTO;
  onEdit: () => void;
  onDelete: () => void;
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const tags = parseTagsString(note.tags);

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground/50">{formatDate(note.noteDate)}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-foreground/60 hover:text-foreground hover:underline"
          >
            Sửa
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
          >
            Xóa
          </button>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
