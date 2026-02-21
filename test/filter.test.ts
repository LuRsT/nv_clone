// Unit tests for filterNotes — pure search logic, no Electron required.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterNotes, sortNotes } from '../src/renderer/search'
import type { NoteInfo } from '../src/renderer/window'

const NOTES: NoteInfo[] = [
  { title: 'Shopping list', excerpt: 'milk eggs bread', body: 'milk eggs bread\nbananas oranges', mtime: 3000 },
  { title: 'Meeting notes', excerpt: 'discussed roadmap', body: 'discussed roadmap\naction items pending', mtime: 2000 },
  { title: 'Ideas', excerpt: 'build a new app', body: 'build a new app\nuse electron framework', mtime: 1000 },
]

test('empty query returns all notes unchanged', () => {
  const result = filterNotes(NOTES, '')
  assert.equal(result.length, 3)
  assert.deepEqual(result, NOTES)
})

test('filters by title substring (case-insensitive)', () => {
  const result = filterNotes(NOTES, 'meeting')
  assert.equal(result.length, 1)
  assert.equal(result[0].title, 'Meeting notes')
})

test('filters by excerpt/body substring', () => {
  const result = filterNotes(NOTES, 'roadmap')
  assert.equal(result.length, 1)
  assert.equal(result[0].title, 'Meeting notes')
})

test('filters by content beyond the first line', () => {
  const result = filterNotes(NOTES, 'electron')
  assert.equal(result.length, 1)
  assert.equal(result[0].title, 'Ideas')
})

test('matches both title and body simultaneously', () => {
  const result = filterNotes(NOTES, 'notes')
  assert.equal(result.length, 1)
  assert.equal(result[0].title, 'Meeting notes')
})

test('query matching multiple notes returns all matches', () => {
  const result = filterNotes(NOTES, 'i')
  assert.ok(result.length > 1)
})

test('no match returns empty array', () => {
  const result = filterNotes(NOTES, 'xyznonexistent')
  assert.equal(result.length, 0)
})

test('whitespace-only query returns all notes', () => {
  const result = filterNotes(NOTES, '   ')
  assert.equal(result.length, 3)
})

test('search is case-insensitive', () => {
  const result = filterNotes(NOTES, 'SHOPPING')
  assert.equal(result.length, 1)
  assert.equal(result[0].title, 'Shopping list')
})

// ── sortNotes ─────────────────────────────────────────────────────────────────

const UNSORTED_NOTES: NoteInfo[] = [
  { title: 'Meeting notes', excerpt: 'discussed roadmap', body: 'discussed roadmap\naction items pending', mtime: 2000 },
  { title: 'Ideas', excerpt: 'build a new app', body: 'build a new app\nuse electron framework', mtime: 5000 },
  { title: 'Shopping list', excerpt: 'milk eggs bread', body: 'milk eggs bread\nbananas oranges', mtime: 1000 },
]

test('sortNotes by mtime returns notes newest-first', () => {
  const result = sortNotes(UNSORTED_NOTES, 'mtime')
  assert.equal(result[0].title, 'Ideas')
  assert.equal(result[1].title, 'Meeting notes')
  assert.equal(result[2].title, 'Shopping list')
})

test('sortNotes by title returns notes in alphabetical order', () => {
  const result = sortNotes(UNSORTED_NOTES, 'title')
  assert.equal(result[0].title, 'Ideas')
  assert.equal(result[1].title, 'Meeting notes')
  assert.equal(result[2].title, 'Shopping list')
})

test('sortNotes does not mutate the original array', () => {
  const original = [...UNSORTED_NOTES]
  sortNotes(UNSORTED_NOTES, 'title')
  assert.deepEqual(UNSORTED_NOTES, original)
})

test('sortNotes on empty array returns empty array', () => {
  assert.deepEqual(sortNotes([], 'mtime'), [])
  assert.deepEqual(sortNotes([], 'title'), [])
})
