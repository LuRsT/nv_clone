// Unit tests for results-list keyboard navigation logic.

import { test } from 'node:test'
import assert from 'node:assert/strict'

function clampedMove(currentIndex: number, delta: number, length: number): number {
  if (length === 0) return currentIndex
  return Math.max(0, Math.min(length - 1, currentIndex + delta))
}

test('moving down increments the index', () => {
  const result = clampedMove(0, 1, 3)
  assert.equal(result, 1)
})

test('moving up decrements the index', () => {
  const result = clampedMove(2, -1, 3)
  assert.equal(result, 1)
})

test('moving up from the top clamps to 0', () => {
  const result = clampedMove(0, -1, 3)
  assert.equal(result, 0)
})

test('moving down from the bottom clamps to last index', () => {
  const result = clampedMove(2, 1, 3)
  assert.equal(result, 2)
})

test('empty list leaves index unchanged', () => {
  const result = clampedMove(-1, 1, 0)
  assert.equal(result, -1)
})
