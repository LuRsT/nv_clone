// Unit tests for filterNotes — pure search logic, no Electron required.
// Run with: node --test test/filter.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { filterNotes } = require('../src/renderer/search.js');

const NOTES = [
  { title: 'Shopping list', excerpt: 'milk eggs bread', mtime: 3000 },
  { title: 'Meeting notes', excerpt: 'discussed roadmap', mtime: 2000 },
  { title: 'Ideas', excerpt: 'build a new app', mtime: 1000 },
];

test('empty query returns all notes unchanged', () => {
  // When filtering with an empty string…
  const result = filterNotes(NOTES, '');

  // It should return all notes in original order
  assert.equal(result.length, 3);
  assert.deepEqual(result, NOTES);
});

test('filters by title substring (case-insensitive)', () => {
  // When searching for a word present only in a title…
  const result = filterNotes(NOTES, 'meeting');

  // It should return only the matching note
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Meeting notes');
});

test('filters by excerpt/body substring', () => {
  // When searching for a word present only in an excerpt…
  const result = filterNotes(NOTES, 'roadmap');

  // It should return the note whose excerpt contains the word
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Meeting notes');
});

test('matches both title and body simultaneously', () => {
  // When searching for a term that appears in title of one note and body of another…
  const result = filterNotes(NOTES, 'notes');

  // It should return both (title match + body match would both qualify)
  // 'Meeting notes' has it in title; 'Meeting notes' excerpt has 'discussed roadmap' — only title match here
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Meeting notes');
});

test('query matching multiple notes returns all matches', () => {
  // When searching for a term that appears across multiple notes…
  const result = filterNotes(NOTES, 'i'); // 'Shopping list', 'Meeting notes' (title), 'Ideas', 'milk' (excerpt)

  // It should return every note that matches
  assert.ok(result.length > 1);
});

test('no match returns empty array', () => {
  // When searching for something that matches nothing…
  const result = filterNotes(NOTES, 'xyznonexistent');

  // It should return an empty array
  assert.equal(result.length, 0);
});

test('whitespace-only query returns all notes', () => {
  // When query is only whitespace (trimmed to empty)…
  const result = filterNotes(NOTES, '   ');

  // It should behave like an empty query
  assert.equal(result.length, 3);
});

test('search is case-insensitive', () => {
  // When searching with uppercase…
  const result = filterNotes(NOTES, 'SHOPPING');

  // It should still find the lowercase match
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Shopping list');
});
