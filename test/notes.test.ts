// Unit tests for notes-helpers — pure functions, no Electron required.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstNonEmptyLine } from '../src/notes-helpers'

test('returns first non-empty line of body', () => {
  const result = firstNonEmptyLine('Hello world\nSecond line')
  assert.equal(result, 'Hello world')
})

test('skips leading blank lines', () => {
  const result = firstNonEmptyLine('\n\n  \nActual content\nMore')
  assert.equal(result, 'Actual content')
})

test('returns empty string for blank body', () => {
  const result = firstNonEmptyLine('  \n  \n  ')
  assert.equal(result, '')
})

test('returns empty string for empty body', () => {
  const result = firstNonEmptyLine('')
  assert.equal(result, '')
})

test('trims whitespace from the returned line', () => {
  const result = firstNonEmptyLine('   padded line   ')
  assert.equal(result, 'padded line')
})
