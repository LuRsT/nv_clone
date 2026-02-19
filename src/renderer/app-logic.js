// Pure renderer logic — no DOM, no window.api, no side effects.

/**
 * Decides what to do when Enter is pressed in the search bar.
 * Returns {action: 'open', title} when results exist, {action: 'create', title}
 * when the list is empty, or null when the query is blank.
 *
 * @param {Array<{title: string}>} filteredNotes
 * @param {number} selectedIndex
 * @param {string} query
 * @returns {{action: string, title: string}|null}
 */
function handleEnterDecision(filteredNotes, selectedIndex, query) {
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
 *
 * @param {Array<{title: string}>} filteredNotes
 * @param {string|null} currentTitle
 * @returns {number}
 */
function restoreSelectionIndex(filteredNotes, currentTitle) {
  if (filteredNotes.length === 0) return -1;

  if (currentTitle) {
    const idx = filteredNotes.findIndex((n) => n.title === currentTitle);
    if (idx >= 0) return idx;
  }

  return 0;
}

const FONT_SIZE_DEFAULT = 14;
const _FONT_SIZE_MIN = 10;
const _FONT_SIZE_MAX = 24;

/**
 * Returns the new editor font size after applying delta steps (+1 / -1 / 0).
 * Clamped to [_FONT_SIZE_MIN, _FONT_SIZE_MAX]. Pass delta=0 to reset to default.
 *
 * @param {number} current
 * @param {number} delta
 * @returns {number}
 */
function adjustFontSize(current, delta) {
  if (delta === 0) return FONT_SIZE_DEFAULT;
  return Math.max(_FONT_SIZE_MIN, Math.min(_FONT_SIZE_MAX, current + delta));
}

/**
 * Ctrl+W / kill-word-backward: deletes from the cursor back to the start of
 * the preceding word (skipping any whitespace immediately before the cursor).
 * If text is selected, deletes the selection instead.
 *
 * @param {string} value
 * @param {number} selectionStart
 * @param {number} selectionEnd
 * @returns {{newValue: string, newCursor: number}}
 */
function deleteWordBackward(value, selectionStart, selectionEnd) {
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
 * Validates a rename operation before hitting the disk.
 * Returns null if the rename is acceptable, or an error string to display.
 *
 * @param {string} newTitle
 * @param {string} currentTitle
 * @param {string[]} existingTitles
 * @returns {string|null}
 */
function validateRename(newTitle, currentTitle, existingTitles) {
  const trimmed = newTitle.trim();
  if (!trimmed) return 'Title cannot be empty';
  if (trimmed !== currentTitle && existingTitles.includes(trimmed)) {
    return `"${trimmed}" already exists`;
  }
  return null;
}

module.exports = { handleEnterDecision, restoreSelectionIndex, adjustFontSize, FONT_SIZE_DEFAULT, deleteWordBackward, validateRename };
