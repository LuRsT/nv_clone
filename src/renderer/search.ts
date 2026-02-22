import type { NoteInfo } from './window'

export type SortOrder = 'mtime' | 'title';

export function sortNotes(notes: NoteInfo[], order: SortOrder): NoteInfo[] {
  if (order === 'title') return [...notes].sort((a, b) => a.title.localeCompare(b.title));
  return [...notes].sort((a, b) => b.mtime - a.mtime);
}

/**
 * filterNotes — pure function, no side effects, no browser globals.
 */
export function filterNotes(notes: NoteInfo[], query: string): NoteInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes; // sorting is applied by sortNotes after filtering

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
  const lower = q.toLowerCase();
  return text
    .split(re)
    .map((part) =>
      part.toLowerCase() === lower ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part),
    )
    .join('');
}
