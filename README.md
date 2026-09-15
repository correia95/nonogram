# Nonogram

Daily nonogram (picross) puzzle: fill an 8x8 grid using row and column
clues to reveal a picture.

- Full constraint-propagation + backtracking solver (`src/nonogram.ts`)
  verifies every puzzle has exactly one solution before it ships
- Daily puzzle picked deterministically from today's UTC date — everyone
  sees the same one, like a daily crossword — plus an unlimited practice
  mode
- Mark mode (or right-click) for placing helper X's; clues grey out once
  satisfied
- No URL share link — per the site's daily-puzzle policy, sharing posts
  spoiler-free result text (puzzle number + time) instead of a link that
  could leak or duplicate the day's puzzle
- Progress on today's puzzle persists in localStorage across a reload

## Develop

```
npm install
npm run dev
npm run build      # tsc --noEmit && vite build
node --experimental-strip-types --test src/nonogram.test.mjs
```

The engine is in `src/nonogram.ts` — `generateLinePossibilities` enumerates
every line matching a clue, `countSolutions`/`solve` do constraint
propagation with backtracking. 14 Node tests in `src/nonogram.test.mjs`,
including verifying every curated puzzle has a unique solution.

## Deploy

Static assets on Cloudflare Workers (`wrangler.jsonc`). Live at
<https://nonogram.correia95.workers.dev/>.
