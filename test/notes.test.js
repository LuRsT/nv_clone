// Unit tests for main-process note helpers.
// Run with: node --test test/notes.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Extract the pure helper inline (avoids importing Electron-dependent main.js)
function firstNonEmptyLine(text) {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

test('returns first non-empty line of body', () => {
  // When body starts with content immediately…
  const result = firstNonEmptyLine('Hello world\nSecond line');

  // It should return the first line
  assert.equal(result, 'Hello world');
});

test('skips leading blank lines', () => {
  // When body starts with blank lines…
  const result = firstNonEmptyLine('\n\n  \nActual content\nMore');

  // It should skip them and return first non-empty line
  assert.equal(result, 'Actual content');
});

test('returns empty string for blank body', () => {
  // When body is entirely whitespace…
  const result = firstNonEmptyLine('  \n  \n  ');

  // It should return empty string
  assert.equal(result, '');
});

test('returns empty string for empty body', () => {
  // When body is empty…
  const result = firstNonEmptyLine('');

  // It should return empty string
  assert.equal(result, '');
});

test('trims whitespace from the returned line', () => {
  // When the first non-empty line has leading/trailing spaces…
  const result = firstNonEmptyLine('   padded line   ');

  // It should return the trimmed version
  assert.equal(result, 'padded line');
});
