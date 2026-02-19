// Unit tests for renderer pure logic — no DOM, no Electron required.
// Run with: node --test test/app-logic.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleEnterDecision, restoreSelectionIndex, adjustFontSize, FONT_SIZE_DEFAULT, deleteWordBackward } = require('../src/renderer/app-logic.js');

// ── handleEnterDecision ────────────────────────────────────────────────────────

const NOTES = [
  { title: 'Alpha', excerpt: 'first note' },
  { title: 'Beta', excerpt: 'second note' },
  { title: 'Gamma', excerpt: 'third note' },
];

test('opens selected note when results exist', () => {
  // When Enter is pressed with matching results and a valid selection…
  const result = handleEnterDecision(NOTES, 1, 'beta');

  // It should return an open action for the selected note
  assert.deepEqual(result, { action: 'open', title: 'Beta' });
});

test('opens first note when selection index is -1', () => {
  // When Enter is pressed with results but no explicit selection…
  const result = handleEnterDecision(NOTES, -1, 'something');

  // It should fall back to the first note
  assert.deepEqual(result, { action: 'open', title: 'Alpha' });
});

test('creates note when filtered list is empty', () => {
  // When Enter is pressed with a query that matches nothing…
  const result = handleEnterDecision([], -1, 'New Note');

  // It should return a create action with the trimmed query as title
  assert.deepEqual(result, { action: 'create', title: 'New Note' });
});

test('creates note using trimmed query', () => {
  // When query has surrounding whitespace and no matches…
  const result = handleEnterDecision([], -1, '  padded  ');

  // It should strip whitespace from the title
  assert.deepEqual(result, { action: 'create', title: 'padded' });
});

test('returns null for empty query', () => {
  // When Enter is pressed with an empty search bar…
  const result = handleEnterDecision(NOTES, 0, '');

  // It should do nothing
  assert.equal(result, null);
});

test('returns null for whitespace-only query', () => {
  // When query is only spaces…
  const result = handleEnterDecision([], 0, '   ');

  // It should do nothing
  assert.equal(result, null);
});

// ── restoreSelectionIndex ──────────────────────────────────────────────────────

test('finds current note in filtered results', () => {
  // When the current note is present in the filtered list…
  const result = restoreSelectionIndex(NOTES, 'Beta');

  // It should return its index
  assert.equal(result, 1);
});

test('falls back to 0 when current note is not in filtered results', () => {
  // When the current note was filtered out (e.g. search changed)…
  const result = restoreSelectionIndex(NOTES, 'Delta');

  // It should select the first result
  assert.equal(result, 0);
});

test('falls back to 0 when no current note', () => {
  // When there is no current note open…
  const result = restoreSelectionIndex(NOTES, null);

  // It should select the first result
  assert.equal(result, 0);
});

test('returns -1 when filtered list is empty', () => {
  // When no notes match the search…
  const result = restoreSelectionIndex([], 'Alpha');

  // It should return -1 (no selection)
  assert.equal(result, -1);
});

// ── adjustFontSize ─────────────────────────────────────────────────────────────

test('increases font size by one step', () => {
  // When pressing Ctrl++ from the default size…
  const result = adjustFontSize(FONT_SIZE_DEFAULT, 1);

  // It should return default + 1
  assert.equal(result, FONT_SIZE_DEFAULT + 1);
});

test('decreases font size by one step', () => {
  // When pressing Ctrl+- from the default size…
  const result = adjustFontSize(FONT_SIZE_DEFAULT, -1);

  // It should return default - 1
  assert.equal(result, FONT_SIZE_DEFAULT - 1);
});

test('clamps at maximum font size', () => {
  // When already at the maximum…
  const result = adjustFontSize(24, 1);

  // It should not exceed the ceiling
  assert.equal(result, 24);
});

test('clamps at minimum font size', () => {
  // When already at the minimum…
  const result = adjustFontSize(10, -1);

  // It should not go below the floor
  assert.equal(result, 10);
});

test('reset returns the default font size', () => {
  // When resetting from an arbitrary size…
  const result = adjustFontSize(FONT_SIZE_DEFAULT, 0);

  // It should return the default unchanged
  assert.equal(result, FONT_SIZE_DEFAULT);
});

// ── deleteWordBackward ─────────────────────────────────────────────────────────

test('deletes the word before the cursor', () => {
  // When cursor is at the end of "hello world"…
  const result = deleteWordBackward('hello world', 11, 11);

  // It should remove "world" and leave the trailing space
  assert.deepEqual(result, { newValue: 'hello ', newCursor: 6 });
});

test('skips whitespace then deletes the word behind it', () => {
  // When cursor is after trailing spaces in "hello world  "…
  const result = deleteWordBackward('hello world  ', 13, 13);

  // It should skip the spaces and delete "world" too
  assert.deepEqual(result, { newValue: 'hello ', newCursor: 6 });
});

test('deletes from cursor back to start when no whitespace exists', () => {
  // When the text has no spaces and cursor is at the end…
  const result = deleteWordBackward('hello', 5, 5);

  // It should clear the entire value
  assert.deepEqual(result, { newValue: '', newCursor: 0 });
});

test('deletes only the characters before the cursor mid-word', () => {
  // When cursor is in the middle of the only word…
  const result = deleteWordBackward('hello', 3, 3);

  // It should delete "hel" and leave "lo"
  assert.deepEqual(result, { newValue: 'lo', newCursor: 0 });
});

test('is a no-op when cursor is at position 0', () => {
  // When there is nothing before the cursor…
  const result = deleteWordBackward('hello', 0, 0);

  // It should leave the value unchanged
  assert.deepEqual(result, { newValue: 'hello', newCursor: 0 });
});

test('deletes the selection when one exists', () => {
  // When text is selected…
  const result = deleteWordBackward('hello world', 6, 11);

  // It should delete just the selection
  assert.deepEqual(result, { newValue: 'hello ', newCursor: 6 });
});
