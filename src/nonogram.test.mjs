import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runsFor, cluesForGrid, generateLinePossibilities, countSolutions, solve,
  gridsEqual, PUZZLES, pickDailyPuzzle, dateSeedFor, puzzleNumber,
} from './nonogram.ts';

test('runsFor encodes runs of filled cells, empty line gives an empty array', () => {
  assert.deepEqual(runsFor([false, false, false]), []);
  assert.deepEqual(runsFor([true, true, true]), [3]);
  assert.deepEqual(runsFor([true, false, true, true, false, true]), [1, 2, 1]);
  assert.deepEqual(runsFor([false, true, false]), [1]);
});

test('cluesForGrid computes rows and columns independently on a small hand-checked grid', () => {
  const grid = [
    [true, false, true],
    [true, true, true],
    [false, true, false],
  ];
  const { rows, cols } = cluesForGrid(grid);
  assert.deepEqual(rows, [[1, 1], [3], [1]]);
  assert.deepEqual(cols, [[2], [2], [2]]);
});

test('generateLinePossibilities produces only lines whose own runs equal the clue', () => {
  for (const [clue, length] of [[[2], 4], [[1, 1], 4], [[3, 2], 8], [[1], 1]]) {
    const candidates = generateLinePossibilities(clue, length);
    assert.ok(candidates.length > 0);
    for (const line of candidates) {
      assert.equal(line.length, length);
      assert.deepEqual(runsFor(line), clue);
    }
  }
});

test('generateLinePossibilities count matches the stars-and-bars closed form', () => {
  // clue [2], length 4: slack=2, k=1 -> C(3,1)=3
  assert.equal(generateLinePossibilities([2], 4).length, 3);
  // clue [1,1], length 4: minLen=3, slack=1, k=2 -> C(3,2)=3
  assert.equal(generateLinePossibilities([1, 1], 4).length, 3);
  // empty clue: exactly one all-empty line
  assert.equal(generateLinePossibilities([], 5).length, 1);
  // impossible: clue too big for length
  assert.equal(generateLinePossibilities([5], 3).length, 0);
});

test('countSolutions finds exactly 1 for a fully-determined 2x2 grid', () => {
  // all-filled rows/cols -> only one grid possible
  const rowClues = [[2], [2]];
  const colClues = [[2], [2]];
  assert.equal(countSolutions(rowClues, colClues, 2, 2), 1);
});

test('countSolutions correctly finds 2 solutions for the classic ambiguous 2x2 diagonal case', () => {
  const rowClues = [[1], [1]];
  const colClues = [[1], [1]];
  assert.equal(countSolutions(rowClues, colClues, 2, 2, 5), 2);
});

test('solve returns a grid whose own clues match the input exactly', () => {
  const target = [
    [true, false, true],
    [true, true, true],
    [false, true, false],
  ];
  const { rows, cols } = cluesForGrid(target);
  const solved = solve(rows, cols, 3, 3);
  assert.ok(solved);
  assert.deepEqual(cluesForGrid(solved), { rows, cols });
});

test('solve returns null for contradictory clues', () => {
  // A 1x1 grid can't simultaneously need a run of 1 and be constrained empty by a col clue of [].
  const solved = solve([[1]], [[]], 1, 1);
  assert.equal(solved, null);
});

test('gridsEqual compares grids by value, not reference', () => {
  const a = [[true, false], [false, true]];
  const b = [[true, false], [false, true]];
  const c = [[true, true], [false, true]];
  assert.equal(gridsEqual(a, b), true);
  assert.equal(gridsEqual(a, c), false);
});

test('every curated puzzle has a unique solution (its clues determine exactly one grid)', () => {
  for (const puzzle of PUZZLES) {
    const { rows, cols } = cluesForGrid(puzzle.grid);
    const solutions = countSolutions(rows, cols, puzzle.grid.length, puzzle.grid[0].length, 2);
    assert.equal(solutions, 1, `${puzzle.name} should have exactly one solution, found ${solutions}`);
  }
});

test('every curated puzzle actually solves back to its own designed grid', () => {
  for (const puzzle of PUZZLES) {
    const { rows, cols } = cluesForGrid(puzzle.grid);
    const solved = solve(rows, cols, puzzle.grid.length, puzzle.grid[0].length);
    assert.ok(solved, `${puzzle.name} should be solvable`);
    assert.ok(gridsEqual(solved, puzzle.grid), `${puzzle.name} solver result should match the designed grid`);
  }
});

test('pickDailyPuzzle is deterministic for the same date seed', () => {
  const a = pickDailyPuzzle('2026-09-16');
  const b = pickDailyPuzzle('2026-09-16');
  assert.deepEqual(a, b);
});

test('pickDailyPuzzle picks a valid index for many different dates', () => {
  for (let d = 1; d <= 28; d++) {
    const seed = dateSeedFor(new Date(Date.UTC(2026, 5, d)));
    const { index } = pickDailyPuzzle(seed);
    assert.ok(index >= 0 && index < PUZZLES.length);
  }
});

test('puzzleNumber increases by exactly 1 per day and starts at 1 on the epoch', () => {
  assert.equal(puzzleNumber(new Date(Date.UTC(2026, 0, 1))), 1);
  assert.equal(puzzleNumber(new Date(Date.UTC(2026, 0, 2))), 2);
  assert.equal(puzzleNumber(new Date(Date.UTC(2026, 0, 31))), 31);
});
