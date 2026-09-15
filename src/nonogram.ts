export type Grid = boolean[][];
export type Clue = number[];

export function runsFor(line: boolean[]): number[] {
  const runs: number[] = [];
  let cur = 0;
  for (const v of line) {
    if (v) cur++;
    else {
      if (cur > 0) runs.push(cur);
      cur = 0;
    }
  }
  if (cur > 0) runs.push(cur);
  return runs;
}

export function cluesForGrid(grid: Grid): { rows: Clue[]; cols: Clue[] } {
  const rows = grid.map(runsFor);
  const cols: Clue[] = [];
  const width = grid[0]?.length ?? 0;
  for (let c = 0; c < width; c++) cols.push(runsFor(grid.map((r) => r[c])));
  return { rows, cols };
}

// Every distinct line of `length` cells whose runs of filled cells equal `clue`.
export function generateLinePossibilities(clue: Clue, length: number): boolean[][] {
  const results: boolean[][] = [];
  const isEmpty = clue.length === 0;
  if (isEmpty) {
    if (length >= 0) results.push(new Array(length).fill(false));
    return results;
  }
  const k = clue.length;
  const minLen = clue.reduce((a, b) => a + b, 0) + (k - 1);
  const slack = length - minLen;
  if (slack < 0) return results;

  function build(blockIndex: number, slackLeft: number, current: boolean[]) {
    if (blockIndex === k) {
      const line = current.slice();
      while (line.length < length) line.push(false);
      results.push(line);
      return;
    }
    for (let extra = 0; extra <= slackLeft; extra++) {
      const line = current.slice();
      if (blockIndex > 0) line.push(false);
      for (let i = 0; i < extra; i++) line.push(false);
      for (let i = 0; i < clue[blockIndex]; i++) line.push(true);
      build(blockIndex + 1, slackLeft - extra, line);
    }
  }
  build(0, slack, []);
  return results;
}

// -1 = unknown, 0 = known empty, 1 = known filled
type Known = number[];
type KnownGrid = Known[];

function candidatesForLine(clue: Clue, length: number, known: Known): boolean[][] {
  return generateLinePossibilities(clue, length).filter((line) =>
    line.every((v, i) => known[i] === -1 || (known[i] === 1) === v),
  );
}

// Constraint-propagates every row/col to a fixed point. Returns false on contradiction.
function propagate(rowClues: Clue[], colClues: Clue[], grid: KnownGrid): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < rows; r++) {
      const cands = candidatesForLine(rowClues[r], cols, grid[r]);
      if (cands.length === 0) return false;
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] !== -1) continue;
        const allFilled = cands.every((cd) => cd[c]);
        const allEmpty = cands.every((cd) => !cd[c]);
        if (allFilled) { grid[r][c] = 1; changed = true; }
        else if (allEmpty) { grid[r][c] = 0; changed = true; }
      }
    }
    for (let c = 0; c < cols; c++) {
      const colKnown = grid.map((row) => row[c]);
      const cands = candidatesForLine(colClues[c], rows, colKnown);
      if (cands.length === 0) return false;
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] !== -1) continue;
        const allFilled = cands.every((cd) => cd[r]);
        const allEmpty = cands.every((cd) => !cd[r]);
        if (allFilled) { grid[r][c] = 1; changed = true; }
        else if (allEmpty) { grid[r][c] = 0; changed = true; }
      }
    }
  }
  return true;
}

function isComplete(grid: KnownGrid): boolean {
  return grid.every((row) => row.every((v) => v !== -1));
}

function findUnknown(grid: KnownGrid): [number, number] | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === -1) return [r, c];
    }
  }
  return null;
}

interface SearchState {
  count: number;
  firstSolution: KnownGrid | null;
}

function search(rowClues: Clue[], colClues: Clue[], grid: KnownGrid, cap: number, state: SearchState): void {
  if (state.count >= cap) return;
  if (!propagate(rowClues, colClues, grid)) return;
  if (isComplete(grid)) {
    state.count++;
    if (!state.firstSolution) state.firstSolution = grid.map((r) => r.slice());
    return;
  }
  const pos = findUnknown(grid);
  if (!pos) return;
  const [r, c] = pos;
  for (const val of [1, 0]) {
    if (state.count >= cap) return;
    const next = grid.map((row) => row.slice());
    next[r][c] = val;
    search(rowClues, colClues, next, cap, state);
  }
}

export function countSolutions(rowClues: Clue[], colClues: Clue[], rows: number, cols: number, cap = 2): number {
  const grid: KnownGrid = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  const state: SearchState = { count: 0, firstSolution: null };
  search(rowClues, colClues, grid, cap, state);
  return state.count;
}

export function solve(rowClues: Clue[], colClues: Clue[], rows: number, cols: number): Grid | null {
  const grid: KnownGrid = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  const state: SearchState = { count: 0, firstSolution: null };
  search(rowClues, colClues, grid, 1, state);
  if (!state.firstSolution) return null;
  return state.firstSolution.map((row) => row.map((v) => v === 1));
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export interface Puzzle {
  name: string;
  grid: Grid;
}

function rowsFromStrings(rows: string[]): Grid {
  return rows.map((row) => row.split('').map((ch) => ch === '1'));
}

export const PUZZLES: Puzzle[] = [
  {
    name: 'Heart',
    grid: rowsFromStrings([
      '01100110',
      '11111111',
      '11111111',
      '11111111',
      '01111110',
      '00111100',
      '00011000',
      '00000000',
    ]),
  },
  {
    name: 'Star',
    grid: rowsFromStrings([
      '00011000',
      '00011000',
      '01111100',
      '11111111',
      '11111111',
      '01111100',
      '00011000',
      '00011000',
    ]),
  },
  {
    name: 'House',
    grid: rowsFromStrings([
      '00011000',
      '00111100',
      '01111110',
      '11111111',
      '11100111',
      '11100111',
      '11100111',
      '11111111',
    ]),
  },
  {
    name: 'Sailboat',
    grid: rowsFromStrings([
      '00010000',
      '00010000',
      '00011100',
      '00010000',
      '01111110',
      '11111111',
      '00000000',
      '00000000',
    ]),
  },
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dateSeedFor(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function pickDailyPuzzle(dateSeed: string): { index: number; puzzle: Puzzle } {
  const rng = mulberry32(hashSeed(dateSeed));
  const index = Math.floor(rng() * PUZZLES.length);
  return { index, puzzle: PUZZLES[index] };
}

const EPOCH = Date.UTC(2026, 0, 1);
export function puzzleNumber(date: Date): number {
  const days = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - EPOCH) / 86400000);
  return days + 1;
}
