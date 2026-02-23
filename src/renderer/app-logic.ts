// Pure renderer logic — no DOM, no window.api, no side effects.

import type { NoteInfo } from './window'

export type EnterDecision =
  | { action: 'open'; title: string }
  | { action: 'create'; title: string };

/**
 * Decides what to do when Enter is pressed in the search bar.
 * Returns {action: 'open', title} when results exist, {action: 'create', title}
 * when the list is empty, or null when the query is blank.
 */
export function handleEnterDecision(
  filteredNotes: NoteInfo[],
  selectedIndex: number,
  query: string,
): EnterDecision | null {
  const q = query.trim();
  if (!q) return null;

  if (filteredNotes.length > 0) {
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    return { action: 'open', title: filteredNotes[idx].title };
  }

  return { action: 'create', title: q };
}

/**
 * After the results list is re-rendered, returns the index that should be
 * selected. Tries to keep the currently open note highlighted; falls back to
 * the first item. Returns -1 when the list is empty.
 */
export function restoreSelectionIndex(filteredNotes: NoteInfo[], currentTitle: string | null): number {
  if (filteredNotes.length === 0) return -1;

  if (currentTitle) {
    const idx = filteredNotes.findIndex((n) => n.title === currentTitle);
    if (idx >= 0) return idx;
  }

  return 0;
}

export const FONT_SIZE_DEFAULT = 14;
const _FONT_SIZE_MIN = 10;
const _FONT_SIZE_MAX = 24;

/**
 * Returns the new editor font size after applying delta steps (+1 / -1 / 0).
 * Clamped to [_FONT_SIZE_MIN, _FONT_SIZE_MAX]. Pass delta=0 to reset to default.
 */
export function adjustFontSize(current: number, delta: number): number {
  if (delta === 0) return FONT_SIZE_DEFAULT;
  return Math.max(_FONT_SIZE_MIN, Math.min(_FONT_SIZE_MAX, current + delta));
}

/**
 * Ctrl+W / kill-word-backward: deletes from the cursor back to the start of
 * the preceding word (skipping any whitespace immediately before the cursor).
 * If text is selected, deletes the selection instead.
 */
export function deleteWordBackward(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): { newValue: string; newCursor: number } {
  if (selectionStart !== selectionEnd) {
    return {
      newValue: value.slice(0, selectionStart) + value.slice(selectionEnd),
      newCursor: selectionStart,
    };
  }

  if (selectionStart === 0) return { newValue: value, newCursor: 0 };

  let pos = selectionStart;
  while (pos > 0 && /\s/.test(value[pos - 1])) pos--;
  while (pos > 0 && !/\s/.test(value[pos - 1])) pos--;

  return {
    newValue: value.slice(0, pos) + value.slice(selectionStart),
    newCursor: pos,
  };
}

/**
 * Formats a modification timestamp as a human-readable relative time string.
 * Uses calendar-day comparison for Yesterday/weekday labels.
 */
export function formatRelativeTime(mtime: number, now = Date.now()): string {
  const diffMs = now - mtime;
  if (diffMs < 0) return 'Just now';

  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  // Calendar-day boundaries — checked before hours so cross-midnight times
  // show "Yesterday" instead of e.g. "22h ago".
  const mtimeDate = new Date(mtime);
  const nowDate = new Date(now);

  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();

  // Same calendar day → show hours
  if (mtime >= todayStart) {
    const diffHours = Math.floor(diffMs / 3600000);
    return `${diffHours}h ago`;
  }

  const yesterday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = yesterday.getTime();

  const weekAgo = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoStart = weekAgo.getTime();

  if (mtime >= yesterdayStart) return 'Yesterday';

  if (mtime >= weekAgoStart) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][mtimeDate.getDay()];
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[mtimeDate.getMonth()];
  const day = mtimeDate.getDate();
  if (mtimeDate.getFullYear() === nowDate.getFullYear()) return `${month} ${day}`;
  return `${month} ${day}, ${mtimeDate.getFullYear()}`;
}

/**
 * Counts the number of words in a text string.
 * Words are sequences of non-whitespace characters separated by whitespace.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Validates a note title for path safety on the renderer side.
 * Returns null if valid, or a user-friendly error message string if invalid.
 */
export function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return 'Title cannot be empty';
  if (trimmed === '..') return 'Title cannot be ".."';
  if (trimmed.startsWith('.')) return 'Title cannot start with a dot';
  if (trimmed.includes('/')) return 'Title cannot contain forward slashes';
  if (trimmed.includes('\\')) return 'Title cannot contain backslashes';
  if (trimmed.includes('\0')) return 'Title cannot contain null characters';
  return null;
}

/**
 * Validates a rename operation before hitting the disk.
 * Returns null if the rename is acceptable, or an error string to display.
 */
export function validateRename(
  newTitle: string,
  currentTitle: string,
  existingTitles: string[],
): string | null {
  const titleError = validateTitle(newTitle);
  if (titleError) return titleError;

  const trimmed = newTitle.trim();
  if (trimmed !== currentTitle && existingTitles.includes(trimmed)) {
    return `"${trimmed}" already exists`;
  }
  return null;
}
