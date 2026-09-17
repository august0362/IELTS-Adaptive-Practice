import { getAllNotes } from "@/lib/db/queries";
import { Journal } from "@/components/journal/Journal";
import type { NoteDTO } from "@/lib/types";

// Live DB read on every request — see page.tsx's identical comment.
export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const notes = await getAllNotes();

  const initialNotes: NoteDTO[] = notes.map((note) => ({
    id: note.id,
    noteDate: note.noteDate.toISOString(),
    tags: note.tags,
    content: note.content,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }));

  return <Journal initialNotes={initialNotes} />;
}
