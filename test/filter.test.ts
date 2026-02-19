// Unit tests for filterNotes — pure search logic, no Electron required.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterNotes } from '../src/renderer/search'
import type { NoteInfo } from '../src/renderer/window'

const NOTES: NoteInfo[] = [
  { title: 'Shopping list', excerpt: 'milk eggs bread', mtime: 3000 },
  { title: 'Meeting notes', excerpt: 'discussed roadmap', mtime: 2000 },
  { title: 'Ideas', excerpt: 'build a new app', mtime: 1000 },
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
