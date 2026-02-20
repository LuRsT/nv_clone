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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * highlightMatches — wraps matching substrings in <mark> tags.
 * Returns HTML-safe string with entities escaped.
 */
export function highlightMatches(text: string, query: string): string {
  const q = query.trim();
  if (!q) return escapeHtml(text);

  const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  return text
    .split(re)
    .map((part) =>
      re.test(part) ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part),
    )
    .join('');
}
