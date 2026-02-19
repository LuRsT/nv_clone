// Unit tests for renderer pure logic — no DOM, no Electron required.
// Run with: node --test test/app-logic.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleEnterDecision, restoreSelectionIndex } = require('../src/renderer/app-logic.js');

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
