// Unit tests for results-list keyboard navigation logic.
// Tests the index-clamping behaviour that underlies _moveSelection and _moveSelectionInList.

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Extracted pure logic: clamp index within [0, length-1]
function clampedMove(currentIndex, delta, length) {
  if (length === 0) return currentIndex;
  return Math.max(0, Math.min(length - 1, currentIndex + delta));
}

test('moving down increments the index', () => {
  // When pressing ArrowDown from index 0 in a 3-item list…
  const result = clampedMove(0, 1, 3);

  // It should select index 1
  assert.equal(result, 1);
});

test('moving up decrements the index', () => {
  // When pressing ArrowUp from index 2…
  const result = clampedMove(2, -1, 3);

  // It should select index 1
  assert.equal(result, 1);
});

test('moving up from the top clamps to 0', () => {
  // When pressing ArrowUp from the first item…
  const result = clampedMove(0, -1, 3);

  // It should stay at 0 (no wrap)
  assert.equal(result, 0);
});

test('moving down from the bottom clamps to last index', () => {
  // When pressing ArrowDown from the last item…
  const result = clampedMove(2, 1, 3);

  // It should stay at 2 (no wrap)
  assert.equal(result, 2);
});

test('empty list leaves index unchanged', () => {
  // When the list is empty…
  const result = clampedMove(-1, 1, 0);

  // It should not change the index
  assert.equal(result, -1);
});
