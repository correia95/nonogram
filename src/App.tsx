import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PUZZLES, cluesForGrid, gridsEqual, pickDailyPuzzle, dateSeedFor, puzzleNumber, runsFor,
} from './nonogram';

type CellState = 0 | 1 | 2; // empty, filled, marked

function emptyUserGrid(rows: number, cols: number): CellState[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

function toBoolGrid(user: CellState[][]): boolean[][] {
  return user.map((row) => row.map((v) => v === 1));
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface SavedProgress {
  puzzleIndex: number;
  cells: CellState[][];
  startedAt: number;
  solved: boolean;
  elapsedAtSolve?: number;
}

function loadDaily(puzzleNum: number): SavedProgress | null {
  try {
    const raw = localStorage.getItem(`nonogram:daily:${puzzleNum}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDaily(puzzleNum: number, progress: SavedProgress) {
  try {
    localStorage.setItem(`nonogram:daily:${puzzleNum}`, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export default function App() {
  const today = useMemo(() => new Date(), []);
  const seed = dateSeedFor(today);
  const dailyPick = useMemo(() => pickDailyPuzzle(seed), [seed]);
  const pnum = puzzleNumber(today);

  const [mode, setMode] = useState<'daily' | 'practice'>('daily');
  const [practiceIndex, setPracticeIndex] = useState(0);
  const puzzleIndex = mode === 'daily' ? dailyPick.index : practiceIndex;
  const puzzle = PUZZLES[puzzleIndex];
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0].length;
  const targetClues = useMemo(() => cluesForGrid(puzzle.grid), [puzzle]);

  const [cells, setCells] = useState<CellState[][]>(() => emptyUserGrid(rows, cols));
  const [solved, setSolved] = useState(false);
  const [markMode, setMarkMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const solvedElapsedRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode !== 'daily') {
      setCells(emptyUserGrid(rows, cols));
      setSolved(false);
      startedAtRef.current = null;
      solvedElapsedRef.current = null;
      setElapsed(0);
      return;
    }
    const saved = loadDaily(pnum);
    if (saved && saved.puzzleIndex === dailyPick.index) {
      setCells(saved.cells);
      setSolved(saved.solved);
      startedAtRef.current = saved.startedAt;
      solvedElapsedRef.current = saved.solved ? saved.elapsedAtSolve ?? 0 : null;
      setElapsed(saved.solved ? saved.elapsedAtSolve ?? 0 : (Date.now() - saved.startedAt) / 1000);
    } else {
      setCells(emptyUserGrid(rows, cols));
      setSolved(false);
      startedAtRef.current = null;
      solvedElapsedRef.current = null;
      setElapsed(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pnum, dailyPick.index]);

  useEffect(() => {
    if (solved || mode !== 'daily') return;
    const id = window.setInterval(() => {
      if (startedAtRef.current) setElapsed((Date.now() - startedAtRef.current) / 1000);
    }, 500);
    return () => window.clearInterval(id);
  }, [solved, mode]);

  function persist(nextCells: CellState[][], nextSolved: boolean) {
    if (mode !== 'daily') return;
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    const elapsedNow = (Date.now() - startedAtRef.current) / 1000;
    if (nextSolved && solvedElapsedRef.current === null) {
      solvedElapsedRef.current = elapsedNow;
      setElapsed(elapsedNow);
    }
    saveDaily(pnum, {
      puzzleIndex: dailyPick.index,
      cells: nextCells,
      startedAt: startedAtRef.current,
      solved: nextSolved,
      elapsedAtSolve: nextSolved ? solvedElapsedRef.current ?? elapsedNow : undefined,
    });
  }

  function toggleCell(r: number, c: number, forceMark = false) {
    if (solved) return;
    setCells((prev) => {
      const next = prev.map((row) => row.slice());
      const useMark = forceMark || markMode;
      const cur = next[r][c];
      if (useMark) {
        next[r][c] = cur === 2 ? 0 : 2;
      } else {
        next[r][c] = cur === 1 ? 0 : 1;
      }
      const isSolved = gridsEqual(toBoolGrid(next), puzzle.grid);
      setSolved(isSolved);
      persist(next, isSolved);
      return next;
    });
  }

  function reset() {
    const fresh = emptyUserGrid(rows, cols);
    setCells(fresh);
    setSolved(false);
    startedAtRef.current = null;
    solvedElapsedRef.current = null;
    setElapsed(0);
    if (mode === 'daily') persist(fresh, false);
  }

  async function shareResult() {
    const text = `Nonogram #${pnum} (${puzzle.name}) — solved in ${fmtTime(elapsed)} \u{1F9E9}\nhttps://nonogram.correia95.workers.dev/`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const rowSatisfied = useMemo(
    () => cells.map((row, r) => {
      const filled = row.map((v) => v === 1);
      return JSON.stringify(runsFor(filled)) === JSON.stringify(targetClues.rows[r]);
    }),
    [cells, targetClues],
  );
  const colSatisfied = useMemo(() => {
    const result: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const filled = cells.map((row) => row[c] === 1);
      result.push(JSON.stringify(runsFor(filled)) === JSON.stringify(targetClues.cols[c]));
    }
    return result;
  }, [cells, targetClues, cols]);

  return (
    <main className="page">
      <h1>Nonogram</h1>
      <p className="lede">
        Fill the grid using the row and column clues. Each clue is the length of every consecutive
        block of filled cells in that line, in order — figure out which cells must be filled.
      </p>

      <div className="mode-row">
        <div className="mode-buttons">
          <button className={mode === 'daily' ? 'active' : ''} onClick={() => setMode('daily')}>Daily #{pnum}</button>
          <button className={mode === 'practice' ? 'active' : ''} onClick={() => setMode('practice')}>Practice</button>
        </div>
        {mode === 'practice' && (
          <select value={practiceIndex} onChange={(e) => setPracticeIndex(Number(e.target.value))}>
            {PUZZLES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
          </select>
        )}
        {mode === 'daily' && <span className="timer">{fmtTime(elapsed)}</span>}
      </div>

      <div className="board-wrap">
        <table className="board">
          <tbody>
            <tr>
              <td className="corner" />
              {Array.from({ length: cols }, (_, c) => (
                <td key={c} className={`col-clue ${colSatisfied[c] ? 'satisfied' : ''}`}>
                  {(targetClues.cols[c].length ? targetClues.cols[c] : [0]).map((n, i) => <div key={i}>{n}</div>)}
                </td>
              ))}
            </tr>
            {puzzle.grid.map((_, r) => (
              <tr key={r}>
                <td className={`row-clue ${rowSatisfied[r] ? 'satisfied' : ''}`}>
                  {(targetClues.rows[r].length ? targetClues.rows[r] : [0]).join(' ')}
                </td>
                {puzzle.grid[r].map((_, c) => (
                  <td
                    key={c}
                    className={`cell ${cells[r][c] === 1 ? 'filled' : ''} ${cells[r][c] === 2 ? 'marked' : ''} ${c % 4 === 3 ? 'block-edge' : ''} ${r % 4 === 3 ? 'block-edge-row' : ''}`}
                    onClick={() => toggleCell(r, c)}
                    onContextMenu={(e) => { e.preventDefault(); toggleCell(r, c, true); }}
                  >
                    {cells[r][c] === 2 ? '✕' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions">
        <button onClick={() => setMarkMode((m) => !m)} className={markMode ? 'active' : ''}>
          {markMode ? 'Mark mode: X' : 'Mark mode: off'}
        </button>
        <button onClick={reset} disabled={solved}>Reset</button>
        {mode === 'daily' && solved && (
          <button onClick={shareResult}>{copied ? 'Copied!' : 'Share result'}</button>
        )}
      </div>

      {solved && (
        <p className="win-message">
          Solved{mode === 'daily' ? ` in ${fmtTime(elapsed)}` : ''}! It's a {puzzle.name.toLowerCase()}.
        </p>
      )}

      <section className="explainer">
        <h2>How to play</h2>
        <p>
          Each row and column has a clue: the lengths of its filled blocks, left-to-right or
          top-to-bottom, with at least one gap between blocks. Tap a cell to fill it; tap again to
          clear it. Toggle "Mark mode" (or right-click on desktop) to place an X on cells you've
          worked out must stay empty — a helper only, it doesn't affect solving. A clue turns grey
          once that row or column already matches it.
        </p>
        <h2>Frequently asked questions</h2>
        <h3>What does a clue like "3 1" mean?</h3>
        <p>
          A block of 3 consecutive filled cells, then at least one empty cell, then a block of 1 —
          in that order, somewhere in the row or column.
        </p>
        <h3>Is there only one way to solve each puzzle?</h3>
        <p>
          Yes — every puzzle here is verified to have exactly one solution before it's published, so
          if the clues are all satisfied, you've found the picture.
        </p>
        <h3>Does the daily puzzle change for everyone at the same time?</h3>
        <p>
          Yes — it's picked deterministically from today's date (UTC), so everyone sees the same
          puzzle on the same day, like a daily crossword.
        </p>
      </section>
    </main>
  );
}
