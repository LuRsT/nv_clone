// Unit tests for renderer pure logic — no DOM, no Electron required.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  handleEnterDecision,
  restoreSelectionIndex,
  adjustFontSize,
  FONT_SIZE_DEFAULT,
  deleteWordBackward,
  validateRename,
  countWords,
} from '../src/renderer/app-logic'
import type { NoteInfo } from '../src/renderer/window'

// ── handleEnterDecision ────────────────────────────────────────────────────────

const NOTES: NoteInfo[] = [
  { title: 'Alpha', excerpt: 'first note', body: 'first note', mtime: 3000 },
  { title: 'Beta', excerpt: 'second note', body: 'second note', mtime: 2000 },
  { title: 'Gamma', excerpt: 'third note', body: 'third note', mtime: 1000 },
]

test('opens selected note when results exist', () => {
  const result = handleEnterDecision(NOTES, 1, 'beta')
  assert.deepEqual(result, { action: 'open', title: 'Beta' })
})

test('opens first note when selection index is -1', () => {
  const result = handleEnterDecision(NOTES, -1, 'something')
  assert.deepEqual(result, { action: 'open', title: 'Alpha' })
})

test('creates note when filtered list is empty', () => {
  const result = handleEnterDecision([], -1, 'New Note')
  assert.deepEqual(result, { action: 'create', title: 'New Note' })
})

test('creates note using trimmed query', () => {
  const result = handleEnterDecision([], -1, '  padded  ')
  assert.deepEqual(result, { action: 'create', title: 'padded' })
})

test('returns null for empty query', () => {
  const result = handleEnterDecision(NOTES, 0, '')
  assert.equal(result, null)
})

test('returns null for whitespace-only query', () => {
  const result = handleEnterDecision([], 0, '   ')
  assert.equal(result, null)
})

// ── restoreSelectionIndex ──────────────────────────────────────────────────────

test('finds current note in filtered results', () => {
  const result = restoreSelectionIndex(NOTES, 'Beta')
  assert.equal(result, 1)
})

test('falls back to 0 when current note is not in filtered results', () => {
  const result = restoreSelectionIndex(NOTES, 'Delta')
  assert.equal(result, 0)
})

test('falls back to 0 when no current note', () => {
  const result = restoreSelectionIndex(NOTES, null)
  assert.equal(result, 0)
})

test('returns -1 when filtered list is empty', () => {
  const result = restoreSelectionIndex([], 'Alpha')
  assert.equal(result, -1)
})

// ── adjustFontSize ─────────────────────────────────────────────────────────────

test('increases font size by one step', () => {
  const result = adjustFontSize(FONT_SIZE_DEFAULT, 1)
  assert.equal(result, FONT_SIZE_DEFAULT + 1)
})

test('decreases font size by one step', () => {
  const result = adjustFontSize(FONT_SIZE_DEFAULT, -1)
  assert.equal(result, FONT_SIZE_DEFAULT - 1)
})

test('clamps at maximum font size', () => {
  const result = adjustFontSize(24, 1)
  assert.equal(result, 24)
})

test('clamps at minimum font size', () => {
  const result = adjustFontSize(10, -1)
  assert.equal(result, 10)
})

test('reset returns the default font size', () => {
  const result = adjustFontSize(FONT_SIZE_DEFAULT, 0)
  assert.equal(result, FONT_SIZE_DEFAULT)
})

// ── deleteWordBackward ─────────────────────────────────────────────────────────

test('deletes the word before the cursor', () => {
  const result = deleteWordBackward('hello world', 11, 11)
  assert.deepEqual(result, { newValue: 'hello ', newCursor: 6 })
})

test('skips whitespace then deletes the word behind it', () => {
  const result = deleteWordBackward('hello world  ', 13, 13)
  assert.deepEqual(result, { newValue: 'hello ', newCursor: 6 })
})

test('deletes from cursor back to start when no whitespace exists', () => {
  const result = deleteWordBackward('hello', 5, 5)
  assert.deepEqual(result, { newValue: '', newCursor: 0 })
})

test('deletes only the characters before the cursor mid-word', () => {
  const result = deleteWordBackward('hello', 3, 3)
  assert.deepEqual(result, { newValue: 'lo', newCursor: 0 })
})

test('is a no-op when cursor is at position 0', () => {
  const result = deleteWordBackward('hello', 0, 0)
  assert.deepEqual(result, { newValue: 'hello', newCursor: 0 })
})

test('deletes the selection when one exists', () => {
  const result = deleteWordBackward('hello world', 6, 11)
  assert.deepEqual(result, { newValue: 'hello ', newCursor: 6 })
})

// ── validateRename ─────────────────────────────────────────────────────────────

const EXISTING = ['Alpha', 'Beta', 'Gamma']

test('returns null for a valid new title', () => {
  const result = validateRename('Delta', 'Alpha', EXISTING)
  assert.equal(result, null)
})

test('returns null when the title is unchanged (no-op rename)', () => {
  const result = validateRename('Alpha', 'Alpha', EXISTING)
  assert.equal(result, null)
})

test('returns an error for an empty title', () => {
  const result = validateRename('', 'Alpha', EXISTING)
  assert.ok(result)
})

test('returns an error for a whitespace-only title', () => {
  const result = validateRename('   ', 'Alpha', EXISTING)
  assert.ok(result)
})

test('returns an error when the title conflicts with another note', () => {
  const result = validateRename('Beta', 'Alpha', EXISTING)
  assert.ok(result)
  assert.match(result!, /Beta/)
})

// ── countWords ────────────────────────────────────────────────────────────────

test('counts words in a simple sentence', () => {
  assert.equal(countWords('hello world'), 2)
})

test('returns 0 for an empty string', () => {
  assert.equal(countWords(''), 0)
})

test('returns 0 for whitespace-only text', () => {
  assert.equal(countWords('   \n\t  '), 0)
})

test('counts words separated by newlines and tabs', () => {
  assert.equal(countWords('one\ntwo\tthree'), 3)
})

test('handles multiple spaces between words', () => {
  assert.equal(countWords('hello    world'), 2)
})

test('counts words with leading and trailing whitespace', () => {
  assert.equal(countWords('  hello world  '), 2)
})
