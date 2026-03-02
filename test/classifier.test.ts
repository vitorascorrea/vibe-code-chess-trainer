import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyMove, computeCpLoss, cpToWinPct, evaluateGame, evaluateGameParallel, uciToSan } from '../src/classifier';
import { EnginePool } from '../src/engine-pool';
import type { EngineEval, EngineScore, PieceColor } from '../src/types';

function makeEval(score: EngineScore, bestMove = 'e2e4'): EngineEval {
  return { score, bestMove, depth: 18, pv: [bestMove] };
}

function cp(value: number): EngineScore {
  return { type: 'cp', value };
}

function mate(value: number): EngineScore {
  return { type: 'mate', value };
}

describe('computeCpLoss', () => {
  it('returns 0 when position improves for the player', () => {
    // White moves, eval goes from +50 to +100 = improvement
    expect(computeCpLoss(cp(50), cp(100), 'w')).toBe(0);
  });

  it('returns positive loss when position worsens for white', () => {
    // White moves, eval goes from +100 to 0 = 100cp loss
    expect(computeCpLoss(cp(100), cp(0), 'w')).toBe(100);
  });

  it('computes loss correctly for black', () => {
    // Black moves, eval goes from -100 (good for black) to 0 = 100cp loss for black
    expect(computeCpLoss(cp(-100), cp(0), 'b')).toBe(100);
  });

  it('handles mate scores — losing a winning mate is huge loss', () => {
    // Had mate in 3, now just +200cp
    const loss = computeCpLoss(mate(3), cp(200), 'w');
    expect(loss).toBeGreaterThan(200);
  });

  it('handles mate-to-mate transitions', () => {
    // Mate in 3 to mate in 5 — still winning, small loss
    const loss = computeCpLoss(mate(3), mate(5), 'w');
    expect(loss).toBeGreaterThanOrEqual(0);
  });

  it('getting mated is maximum loss', () => {
    // Was equal, now getting mated
    const loss = computeCpLoss(cp(0), mate(-2), 'w');
    expect(loss).toBeGreaterThan(200);
  });
});

describe('classifyMove', () => {
  it('classifies "Best" when move matches engine top choice with 0 loss', () => {
    const evalBefore = makeEval(cp(50), 'e2e4');
    const evalAfter = makeEval(cp(50));
    const result = classifyMove(evalBefore, evalAfter, 'e2e4', 'e2e4', 'w');
    expect(result).toBe('best');
  });

  it('classifies "Excellent" when different move but near-zero loss in a normal position', () => {
    // +0.5 to +0.6 — tiny improvement, but not engine best. Normal position, not critical.
    const evalBefore = makeEval(cp(50), 'e2e4');
    const evalAfter = makeEval(cp(60));
    const result = classifyMove(evalBefore, evalAfter, 'd2d4', 'e2e4', 'w');
    expect(result).toBe('excellent'); // NOT "great" — position wasn't critical
  });

  it('classifies "Great" only when finding a strong move in a losing position', () => {
    // White was losing (-200cp, ~27% winPct), played a non-engine move that kept the position
    // nearly as good as the engine's best (-190cp). Critical recovery = "great".
    const evalBefore = makeEval(cp(-200), 'e2e4');
    const evalAfter = makeEval(cp(-190));
    const result = classifyMove(evalBefore, evalAfter, 'd2d4', 'e2e4', 'w');
    expect(result).toBe('great');
  });

  it('does NOT classify "Great" when position is comfortable', () => {
    // White at +0.5, plays a move with 0 loss — that's "excellent", not "great"
    const evalBefore = makeEval(cp(50), 'e2e4');
    const evalAfter = makeEval(cp(55));
    const result = classifyMove(evalBefore, evalAfter, 'd2d4', 'e2e4', 'w');
    expect(result).not.toBe('great');
  });

  it('classifies "Great" for black finding a saving move when losing', () => {
    // Black was losing (+300cp for white = bad for black), found a near-best move
    const evalBefore = makeEval(cp(300), 'e7e5');
    const evalAfter = makeEval(cp(290));
    const result = classifyMove(evalBefore, evalAfter, 'd7d5', 'e7e5', 'b');
    expect(result).toBe('great');
  });

  it('classifies "Excellent" for ≤10cp loss', () => {
    const evalBefore = makeEval(cp(50), 'e2e4');
    const evalAfter = makeEval(cp(42));
    const result = classifyMove(evalBefore, evalAfter, 'd2d4', 'e2e4', 'w');
    expect(result).toBe('excellent');
  });

  it('classifies "Good" for ≤30cp loss', () => {
    const evalBefore = makeEval(cp(50), 'e2e4');
    const evalAfter = makeEval(cp(25));
    const result = classifyMove(evalBefore, evalAfter, 'd2d4', 'e2e4', 'w');
    expect(result).toBe('good');
  });

  it('classifies "Inaccuracy" for ≤100cp loss', () => {
    const evalBefore = makeEval(cp(100), 'e2e4');
    const evalAfter = makeEval(cp(25));
    const result = classifyMove(evalBefore, evalAfter, 'd2d4', 'e2e4', 'w');
    expect(result).toBe('inaccuracy');
  });

  it('classifies "Mistake" for ≤200cp loss', () => {
    const evalBefore = makeEval(cp(100), 'e2e4');
    const evalAfter = makeEval(cp(-50));
    const result = classifyMove(evalBefore, evalAfter, 'd2d4', 'e2e4', 'w');
    expect(result).toBe('mistake');
  });

  it('classifies "Blunder" for >200cp loss', () => {
    const evalBefore = makeEval(cp(100), 'e2e4');
    const evalAfter = makeEval(cp(-200));
    const result = classifyMove(evalBefore, evalAfter, 'd2d4', 'e2e4', 'w');
    expect(result).toBe('blunder');
  });

  it('classifies correctly for black moves', () => {
    // Black's perspective: eval goes from -100 (good for black) to +100 (bad for black) = 200cp loss
    const evalBefore = makeEval(cp(-100), 'e7e5');
    const evalAfter = makeEval(cp(100));
    const result = classifyMove(evalBefore, evalAfter, 'd7d5', 'e7e5', 'b');
    expect(result).toBe('mistake');
  });

  it('handles mate-in-N correctly (not infinite cp)', () => {
    const evalBefore = makeEval(cp(0), 'e2e4');
    const evalAfter = makeEval(mate(-3)); // blundered into mate
    const result = classifyMove(evalBefore, evalAfter, 'd2d4', 'e2e4', 'w');
    expect(result).toBe('blunder');
  });

  it('engine best move is ALWAYS "best" — even when eval shifts (horizon effect)', () => {
    // Bug repro: player plays Nxd4, engine says Nxd4 is best, but eval drops 75cp
    // due to horizon effect. Should still be "best", not "inaccuracy".
    const evalBefore = makeEval(cp(50), 'f3d4');   // engine says Nxd4 is best, +0.5
    const evalAfter = makeEval(cp(-25));            // after Nxd4, eval shifted to -0.25
    const result = classifyMove(evalBefore, evalAfter, 'f3d4', 'f3d4', 'w');
    expect(result).toBe('best');
  });

  it('engine best move is "best" for black too, regardless of eval shift', () => {
    const evalBefore = makeEval(cp(-100), 'e7e5');
    const evalAfter = makeEval(cp(0)); // eval shifted 100cp against black
    const result = classifyMove(evalBefore, evalAfter, 'e7e5', 'e7e5', 'b');
    expect(result).toBe('best');
  });

  it('classifies "Brilliant" for sacrifice that improves position', () => {
    // Played move is not engine top, but position improved by ≥50cp, and move involves capture on a square
    // where the piece can be recaptured (sacrifice heuristic)
    const evalBefore = makeEval(cp(0), 'e2e4');
    const evalAfter = makeEval(cp(80));
    const result = classifyMove(evalBefore, evalAfter, 'f1c4', 'e2e4', 'w', true);
    expect(result).toBe('brilliant');
  });
});

describe('cpToWinPct', () => {
  it('returns 50% for equal position', () => {
    expect(cpToWinPct(0)).toBe(50);
  });

  it('returns >50% for white advantage', () => {
    expect(cpToWinPct(100)).toBeGreaterThan(50);
  });

  it('returns <50% for black advantage', () => {
    expect(cpToWinPct(-100)).toBeLessThan(50);
  });

  it('approaches 100% for large white advantage', () => {
    expect(cpToWinPct(1000)).toBeGreaterThan(95);
  });

  it('a 100cp loss at +10.0 barely moves win%', () => {
    // At +1000cp, losing 100cp is negligible
    const before = cpToWinPct(1000);
    const after = cpToWinPct(900);
    expect(before - after).toBeLessThan(2);
  });

  it('a 100cp loss at +0.5 is significant in win%', () => {
    // At +50cp, losing 100cp is a big deal
    const before = cpToWinPct(50);
    const after = cpToWinPct(-50);
    expect(before - after).toBeGreaterThan(5);
  });
});

describe('classifyMove — eval cap at ±1000cp', () => {
  it('losing 500cp from +1500 to +1000 is capped — not a blunder', () => {
    // Without cap: +1500 → +1000 = big loss. With cap: both clamp to ~+1000 → negligible
    const result = classifyMove(
      makeEval(cp(1500), 'e2e4'), makeEval(cp(1000)),
      'd2d4', 'e2e4', 'w'
    );
    // Should NOT be blunder/mistake since both are winning
    expect(['excellent', 'good', 'best']).toContain(result);
  });

  it('losing 500cp from -1000 to -1500 is capped for black too', () => {
    // Black moves, eval goes from -1500 (great for black) to -1000 (still great for black)
    const result = classifyMove(
      makeEval(cp(-1500), 'e7e5'), makeEval(cp(-1000)),
      'd7d5', 'e7e5', 'b'
    );
    expect(['excellent', 'good', 'best']).toContain(result);
  });

  it('mate scores are capped — going from mate-in-3 to +500 is not a blunder', () => {
    // Mate scores should clamp to ±1000, so mate → +500 = 1000→500 = ~moderate
    // This tests that mate handling doesn't produce wild phantom losses
    const result = classifyMove(
      makeEval(mate(3), 'e2e4'), makeEval(cp(500)),
      'd2d4', 'e2e4', 'w'
    );
    // Should be bad but not "blunder" territory since both are still clearly winning
    expect(result).not.toBe('blunder');
  });
});

describe('classifyMove — dead-draw detection', () => {
  it('classifies as "good" (not "excellent") in dead-drawn position', () => {
    // Both evals near 0, non-engine-best move — this is a dead position
    const result = classifyMove(
      makeEval(cp(5), 'e2e4'), makeEval(cp(3)),
      'd2d4', 'e2e4', 'w'
    );
    expect(result).toBe('good');
  });

  it('classifies as "good" for black in dead-draw', () => {
    // Eval stays near 0 for both sides
    const result = classifyMove(
      makeEval(cp(-5), 'e7e5'), makeEval(cp(-3)),
      'd7d5', 'e7e5', 'b'
    );
    expect(result).toBe('good');
  });

  it('still classifies "excellent" when position has tension (not dead)', () => {
    // +100cp is not a dead-draw — there's real advantage here
    const result = classifyMove(
      makeEval(cp(100), 'e2e4'), makeEval(cp(100)),
      'd2d4', 'e2e4', 'w'
    );
    expect(result).toBe('excellent');
  });

  it('engine best move is still "best" even in dead-draw', () => {
    const result = classifyMove(
      makeEval(cp(0), 'e2e4'), makeEval(cp(0)),
      'e2e4', 'e2e4', 'w'
    );
    expect(result).toBe('best');
  });
});

describe('classifyMove — win percentage thresholds', () => {
  it('100cp loss at extreme advantage is less severe than at equal position', () => {
    // At +10.0, losing 100cp → should be mild
    const extreme = classifyMove(
      makeEval(cp(1000), 'e2e4'), makeEval(cp(900)),
      'd2d4', 'e2e4', 'w'
    );
    // At +0.5, losing 100cp → should be more severe
    const equal = classifyMove(
      makeEval(cp(50), 'e2e4'), makeEval(cp(-50)),
      'd2d4', 'e2e4', 'w'
    );
    // The extreme case should be milder classification
    const severity = ['excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
    expect(severity.indexOf(extreme as string)).toBeLessThan(severity.indexOf(equal as string));
  });
});

describe('uciToSan', () => {
  it('converts e2e4 from starting position to e4', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(uciToSan(fen, 'e2e4')).toBe('e4');
  });

  it('converts a knight move correctly', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(uciToSan(fen, 'g8f6')).toBe('Nf6');
  });

  it('handles promotions', () => {
    const fen = '8/P7/8/8/8/8/8/4K2k w - - 0 1';
    // Promotion gives check in this position, so SAN includes +
    expect(uciToSan(fen, 'a7a8q')).toBe('a8=Q+');
  });

  it('returns null for invalid UCI moves', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(uciToSan(fen, 'e4e5')).toBeNull();
  });
});

describe('evaluateGame — eval caching', () => {
  it('reuses evalAfter as next evalBefore — halves engine calls', async () => {
    let callCount = 0;
    const evalFn = async (fen: string) => {
      callCount++;
      return makeEval(cp(30), 'a1a2');
    };

    // Use mid-game FENs that are definitely NOT in the opening trie
    const moves = [
      { index: 0, san: 'Kf2', from: 'e1', to: 'f2', color: 'w' as PieceColor,
        fenBefore: '4k3/8/8/8/8/8/8/4K3 w - - 0 40',
        fenAfter: '4k3/8/8/8/8/8/5K2/8 b - - 1 40' },
      { index: 1, san: 'Kd7', from: 'e8', to: 'd7', color: 'b' as PieceColor,
        fenBefore: '4k3/8/8/8/8/8/5K2/8 b - - 1 40',
        fenAfter: '8/3k4/8/8/8/8/5K2/8 w - - 2 41' },
      { index: 2, san: 'Ke3', from: 'f2', to: 'e3', color: 'w' as PieceColor,
        fenBefore: '8/3k4/8/8/8/8/5K2/8 w - - 2 41',
        fenAfter: '8/3k4/8/8/8/4K3/8/8 b - - 3 41' },
    ];

    await evaluateGame(evalFn, moves);

    // Without cache: 3 moves × 2 evals = 6 calls
    // With cache: move 0 = 2 calls, move 1 = 1 call (reuse), move 2 = 1 call (reuse) = 4 total
    expect(callCount).toBe(4);
  });
});

describe('evaluateGame — book moves', () => {
  // Moves for 1. e4 e5 — both are in the openings trie
  const bookMoves = [
    { index: 0, san: 'e4', from: 'e2', to: 'e4', color: 'w' as PieceColor,
      fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' },
    { index: 1, san: 'e5', from: 'e7', to: 'e5', color: 'b' as PieceColor,
      fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
    { index: 2, san: 'Nf3', from: 'g1', to: 'f3', color: 'w' as PieceColor,
      fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
  ];

  const dummyEvaluateFn = async () => makeEval(cp(30), 'g1f3');

  it('marks opening moves as "book" with null evals', async () => {
    const evals = await evaluateGame(dummyEvaluateFn, bookMoves);

    // e4, e5, Nf3 are all in the openings trie
    // At minimum e4 and e5 should be book (depends on trie depth)
    const bookEvals = evals.filter((e) => e.classification === 'book');
    expect(bookEvals.length).toBeGreaterThanOrEqual(2);

    for (const be of bookEvals) {
      expect(be.evalBefore).toBeNull();
      expect(be.evalAfter).toBeNull();
      expect(be.cpLoss).toBe(0);
    }
  });

  it('provides engineSuggestionSan for bad moves', async () => {
    // Simulate: 1.e4 e5 (book), then 2.Ke2?? (blunder, out of book)
    const moves = [
      { index: 0, san: 'e4', from: 'e2', to: 'e4', color: 'w' as PieceColor,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' },
      { index: 1, san: 'e5', from: 'e7', to: 'e5', color: 'b' as PieceColor,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
      // h3 is NOT in the trie after 1.e4 e5
      { index: 2, san: 'h3', from: 'h2', to: 'h3', color: 'w' as PieceColor,
        fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/7P/PPPP1PP1/RNBQKBNR b KQkq - 0 2' },
    ];

    // h3 is not in the trie. Engine says Nf3 was best.
    const evalFn = async (fen: string) => {
      if (fen.includes('7P')) return makeEval(cp(-200), 'b8c6'); // after h3, bad
      if (fen.includes('4p3') && fen.includes('w KQkq')) return makeEval(cp(100), 'g1f3'); // before h3
      return makeEval(cp(30), 'e2e4');
    };

    const evals = await evaluateGame(evalFn, moves);
    // First two are book
    expect(evals[0].classification).toBe('book');
    expect(evals[1].classification).toBe('book');
    // Third is a blunder with engine suggestion
    expect(evals[2].classification).toBe('blunder');
    expect(evals[2].engineSuggestionSan).toBe('Nf3'); // UCI g1f3 → SAN Nf3
  });
});

// --- evaluateGameParallel tests ---

// Mock Worker that returns FEN-dependent evals for parallel tests
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  private handlers: Array<(msg: string) => void> = [];
  private currentFen = '';

  addEventListener(event: string, handler: (e: MessageEvent) => void) {
    if (event === 'message') {
      this.handlers.push((msg) => handler(new MessageEvent('message', { data: msg })));
    }
  }

  removeEventListener() {}

  postMessage(msg: string) {
    setTimeout(() => this.handleCommand(msg), 0);
  }

  terminate() {}

  private reply(msg: string) {
    for (const handler of this.handlers) handler(msg);
    if (this.onmessage) this.onmessage(new MessageEvent('message', { data: msg }));
  }

  private handleCommand(cmd: string) {
    if (cmd === 'uci') {
      this.reply('id name Stockfish 16');
      this.reply('uciok');
    } else if (cmd === 'isready') {
      this.reply('readyok');
    } else if (cmd.startsWith('position fen ')) {
      this.currentFen = cmd.slice('position fen '.length);
    } else if (cmd.startsWith('go')) {
      // Return different scores based on FEN content for testability
      const cpValue = this.currentFen.includes('4K3') ? 0 : 30;
      this.reply(`info depth 20 score cp ${cpValue} pv a1a2`);
      this.reply('bestmove a1a2');
    } else if (cmd === 'stop') {
      this.reply('bestmove a1a2');
    }
  }
}

describe('evaluateGameParallel', () => {
  let pool: EnginePool;

  beforeEach(() => {
    vi.stubGlobal('Worker', vi.fn(() => new MockWorker()));
  });

  afterEach(() => {
    pool?.destroy();
    vi.unstubAllGlobals();
  });

  // Non-book moves used across tests
  const midGameMoves = [
    { index: 0, san: 'Kf2', from: 'e1', to: 'f2', color: 'w' as PieceColor,
      fenBefore: '4k3/8/8/8/8/8/8/4K3 w - - 0 40',
      fenAfter: '4k3/8/8/8/8/8/5K2/8 b - - 1 40' },
    { index: 1, san: 'Kd7', from: 'e8', to: 'd7', color: 'b' as PieceColor,
      fenBefore: '4k3/8/8/8/8/8/5K2/8 b - - 1 40',
      fenAfter: '8/3k4/8/8/8/8/5K2/8 w - - 2 41' },
    { index: 2, san: 'Ke3', from: 'f2', to: 'e3', color: 'w' as PieceColor,
      fenBefore: '8/3k4/8/8/8/8/5K2/8 w - - 2 41',
      fenAfter: '8/3k4/8/8/8/4K3/8/8 b - - 3 41' },
  ];

  it('evaluates all positions and classifies moves', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    await pool.init();

    const evals = await evaluateGameParallel(pool, midGameMoves);

    expect(evals.length).toBe(3);
    for (const ev of evals) {
      expect(ev.evalBefore).not.toBeNull();
      expect(ev.evalAfter).not.toBeNull();
      expect(ev.classification).not.toBe('book');
    }
  });

  it('deduplicates FENs — fenAfter[i] === fenBefore[i+1]', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    await pool.init();

    // Count unique FENs: 3 fenBefore + 3 fenAfter, but fenAfter[0]=fenBefore[1] and fenAfter[1]=fenBefore[2]
    // So unique = fenBefore[0], fenAfter[0]=fenBefore[1], fenAfter[1]=fenBefore[2], fenAfter[2] = 4
    const evals = await evaluateGameParallel(pool, midGameMoves);
    expect(evals.length).toBe(3);
    // The key property: evalAfter of move 0 should have the same score as evalBefore of move 1
    // because they come from the same FEN (only evaluated once)
    expect(evals[0].evalAfter!.score.value).toBe(evals[1].evalBefore!.score.value);
    expect(evals[1].evalAfter!.score.value).toBe(evals[2].evalBefore!.score.value);
  });

  it('marks book moves with null evals', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    await pool.init();

    const bookMoves = [
      { index: 0, san: 'e4', from: 'e2', to: 'e4', color: 'w' as PieceColor,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' },
      { index: 1, san: 'e5', from: 'e7', to: 'e5', color: 'b' as PieceColor,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
    ];

    const evals = await evaluateGameParallel(pool, bookMoves);
    const bookEvals = evals.filter((e) => e.classification === 'book');
    expect(bookEvals.length).toBeGreaterThanOrEqual(2);
    for (const be of bookEvals) {
      expect(be.evalBefore).toBeNull();
      expect(be.evalAfter).toBeNull();
      expect(be.cpLoss).toBe(0);
    }
  });

  it('reports progress as positions are evaluated', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    await pool.init();

    const progressCalls: Array<[number, number]> = [];
    await evaluateGameParallel(pool, midGameMoves, undefined, (current, total) => {
      progressCalls.push([current, total]);
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    // Final progress should be total/total
    const last = progressCalls[progressCalls.length - 1];
    expect(last[0]).toBe(last[1]);
  });

  it('produces same classifications as sequential evaluateGame for identical inputs', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 1);
    await pool.init();

    // Use the sequential evaluateGame with a mock that returns the same as the MockWorker
    const evalFn = async (fen: string): Promise<EngineEval> => {
      const cpValue = fen.includes('4K3') ? 0 : 30;
      const isBlack = fen.split(' ')[1] === 'b';
      return {
        score: { type: 'cp', value: isBlack ? -cpValue : cpValue },
        bestMove: 'a1a2',
        depth: 20,
        pv: ['a1a2'],
      };
    };

    const seqEvals = await evaluateGame(evalFn, midGameMoves);
    const parEvals = await evaluateGameParallel(pool, midGameMoves);

    expect(parEvals.length).toBe(seqEvals.length);
    for (let i = 0; i < seqEvals.length; i++) {
      expect(parEvals[i].classification).toBe(seqEvals[i].classification);
      expect(parEvals[i].cpLoss).toBe(seqEvals[i].cpLoss);
    }
  });
});
