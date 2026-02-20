import type { NoteInfo } from './window'

/**
 * filterNotes — pure function, no side effects, no browser globals.
 */
export function filterNotes(notes: NoteInfo[], query: string): NoteInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes; // already sorted by mtime desc from main process

  return notes.filter((note) => {
    return (
      note.title.toLowerCase().includes(q) ||
      note.body.toLowerCase().includes(q)
    );
  });
}
