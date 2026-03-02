# Vibe Code Chess Trainer

A browser-based chess game analyzer. Paste a PGN from Chess.com, and the app evaluates every move using Stockfish WASM — classifying each as brilliant, great, best, excellent, good, inaccuracy, mistake, or blunder.

Built entirely through vibe coding with Claude Code.

## Features

- **PGN Import** — Paste any Chess.com PGN to load and analyze a game
- **Stockfish WASM Analysis** — Runs Stockfish 16 NNUE locally in the browser at depth 20
- **Move Classification** — Each move is classified using win-percentage loss thresholds aligned with Chess.com's expected points model:
  - Best, Excellent (<=2%), Good (<=5%), Inaccuracy (<=10%), Mistake (<=20%), Blunder (>20%)
  - Special classifications: Brilliant (sacrifice that improves position), Great (strong move in a losing position), Book (opening theory)
- **Vertical Eval Bar** — White/black fill bar beside the board shows who's winning, with smooth animated transitions
- **Interactive Board** — Click through moves, use arrow keys to navigate, or click moves in the move list
- **Opening Detection** — Automatically identifies the opening played from a built-in ECO database
- **Free Play Mode** — Branch off at any point to explore alternative lines
- **Game History** — Analyzed games are saved to localStorage for quick replay
- **Keyboard Shortcuts** — Arrow keys (navigate), Home/End (jump to start/end), F (flip board), Escape (exit free play)
- **Full-Screen Eval Overlay** — Blocks the UI during evaluation with a progress indicator

## Tech Stack

- **TypeScript** + **Vite 5**
- **chess.js** — Move generation, validation, PGN parsing
- **cm-chessboard** — SVG chessboard with arrows and markers
- **Stockfish 16 NNUE** — WASM single-threaded build, running in a Web Worker
- **Vitest** — Unit tests with jsdom environment

## Getting Started

```bash
# Install dependencies
npm install

# Copy Stockfish WASM binary to public/
npm run setup:stockfish

# Start dev server
npm run dev
```

Open http://localhost:5173 in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run setup:stockfish` | Copy Stockfish binary to `public/` |

## How Classification Works

Scores from Stockfish are normalized to white's perspective, then converted to win probability using the Lichess logistic model:

```
WinPct = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
```

The win-percentage loss between the position before and after each move determines the classification. This means a 100cp loss at +10.0 (negligible) is treated differently from a 100cp loss at +0.5 (devastating).

Evaluations are capped at +/-10.0 (1000cp) to prevent phantom losses in already-decided positions.

## Project Structure

```
src/
  main.ts              # App entry point, screen routing, evaluation orchestration
  game-manager.ts      # PGN parsing, move navigation, free play branching
  classifier.ts        # Win% model, move classification, eval caching
  engine.ts            # Stockfish WASM wrapper, score normalization
  board-controller.ts  # cm-chessboard integration, arrows, markers
  eval-store.ts        # localStorage persistence for analyzed games
  openings.ts          # ECO opening trie lookup
  state.ts             # Global app state and event bus
  types.ts             # TypeScript interfaces
  style.css            # All styles
  ui/
    layout.ts          # DOM structure
    eval-bar.ts        # Vertical eval bar
    eval-overlay.ts    # Full-screen progress overlay
    game-info.ts       # Player names, ratings, opening
    move-list.ts       # Annotated move list with classification badges
    nav-controls.ts    # Navigation buttons, flip, evaluate, free play
    history-panel.ts   # Saved games list
test/
  classifier.test.ts   # 42 tests — classification, eval cap, dead-draw, caching
  engine.test.ts       # 6 tests — UCI protocol, score normalization
  game-manager.test.ts # 25 tests — PGN parsing, navigation, free play
  eval-store.test.ts   # 8 tests — localStorage CRUD
  openings.test.ts     # 11 tests — ECO lookup
```
