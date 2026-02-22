// Unit tests for highlightMatches — pure function, no DOM required.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { highlightMatches } from '../src/renderer/search'

test('empty query returns text unchanged', () => {
  assert.equal(highlightMatches('Hello world', ''), 'Hello world')
})

test('no match returns text unchanged', () => {
  assert.equal(highlightMatches('Hello world', 'xyz'), 'Hello world')
})

test('wraps matching substring in <mark> tags', () => {
  assert.equal(highlightMatches('Hello world', 'world'), 'Hello <mark>world</mark>')
})

test('match is case-insensitive', () => {
  assert.equal(highlightMatches('Hello World', 'hello'), '<mark>Hello</mark> World')
})

test('highlights all occurrences', () => {
  assert.equal(
    highlightMatches('an ant on an anvil', 'an'),
    '<mark>an</mark> <mark>an</mark>t on <mark>an</mark> <mark>an</mark>vil',
  )
})

test('escapes HTML entities in non-matching text', () => {
  assert.equal(
    highlightMatches('<script>alert("xss")</script>', 'xyz'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
  )
})

test('escapes HTML in matched text too', () => {
  assert.equal(
    highlightMatches('a<b>c', '<b>'),
    'a<mark>&lt;b&gt;</mark>c',
  )
})

test('whitespace-only query returns text unchanged', () => {
  assert.equal(highlightMatches('Hello world', '   '), 'Hello world')
})

test('highlights consecutive adjacent matches without skipping', () => {
  // Regression: g-flag regex .test() has stateful lastIndex, causing
  // alternating true/false on back-to-back matches.
  assert.equal(
    highlightMatches('aaa', 'a'),
    '<mark>a</mark><mark>a</mark><mark>a</mark>',
  )
})

test('handles regex special characters in query', () => {
  assert.equal(
    highlightMatches('price is $10.00', '$10.00'),
    'price is <mark>$10.00</mark>',
  )
})
