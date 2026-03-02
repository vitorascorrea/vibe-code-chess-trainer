import { Chess } from 'chess.js';
import type { EngineEval, EngineScore, MoveClassification, MoveEvaluation, PieceColor } from './types';
import type { EnginePool } from './engine-pool';
import type { EvaluateOptions } from './engine';
import { getBookDepth } from './openings';

const MATE_CP = 10000; // centipawn equivalent for mate
const EVAL_CAP = 1000; // clamp evals at ±1000cp (Lichess convention)

/**
 * Convert an engine score to a centipawn value from white's perspective.
 * Clamped to ±1000cp to prevent phantom losses in decided positions.
 */
function scoreToCp(score: EngineScore): number {
  let cp: number;
  if (score.type === 'cp') {
    cp = score.value;
  } else {
    cp = score.value > 0
      ? MATE_CP - score.value * 10
      : -MATE_CP - score.value * 10;
  }
  return Math.max(-EVAL_CAP, Math.min(EVAL_CAP, cp));
}

/**
 * Convert centipawns to win percentage (0-100).
 * Uses Lichess's calibrated logistic formula derived from real game data.
 */
export function cpToWinPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Compute centipawn loss for the moving color. Returns 0 if position improved. */
export function computeCpLoss(
  scoreBefore: EngineScore,
  scoreAfter: EngineScore,
  color: PieceColor
): number {
  const cpBefore = scoreToCp(scoreBefore);
  const cpAfter = scoreToCp(scoreAfter);
  const sign = color === 'w' ? 1 : -1;
  const loss = sign * (cpBefore - cpAfter);
  return Math.max(0, loss);
}

/**
 * Compute win-percentage loss for the moving color.
 * More accurate than raw cp because 100cp at +10.0 is negligible
 * but 100cp at +0.5 is devastating.
 */
function computeWinPctLoss(
  scoreBefore: EngineScore,
  scoreAfter: EngineScore,
  color: PieceColor
): number {
  const cpBefore = scoreToCp(scoreBefore);
  const cpAfter = scoreToCp(scoreAfter);

  // Win% from the mover's perspective
  const winBefore = color === 'w' ? cpToWinPct(cpBefore) : cpToWinPct(-cpBefore);
  const winAfter = color === 'w' ? cpToWinPct(cpAfter) : cpToWinPct(-cpAfter);

  return Math.max(0, winBefore - winAfter);
}

/** Classify a move based on engine evaluation using win-percentage thresholds. */
export function classifyMove(
  evalBefore: EngineEval,
  evalAfter: EngineEval,
  playedMove: string,
  engineBestMove: string,
  color: PieceColor,
  isSacrifice = false
): MoveClassification {
  const isEngineBest = playedMove === engineBestMove;

  // Engine's top choice is ALWAYS "best" — no horizon-effect false positives
  if (isEngineBest) return 'best';

  const winPctLoss = computeWinPctLoss(evalBefore.score, evalAfter.score, color);
  const cpLoss = computeCpLoss(evalBefore.score, evalAfter.score, color);

  const cpBefore = scoreToCp(evalBefore.score);
  const cpAfter = scoreToCp(evalAfter.score);

  // Brilliant: not engine top, involves sacrifice, and improves position ≥50cp
  if (cpLoss === 0 && isSacrifice) {
    const sign = color === 'w' ? 1 : -1;
    const improvement = sign * (cpAfter - cpBefore);
    if (improvement >= 50) return 'brilliant';
  }

  // Dead-draw / flat position: both evals near 0, negligible loss.
  // Don't inflate classification — "good" is honest for meaningless moves.
  const isFlat = Math.abs(cpBefore) <= 25 && Math.abs(cpAfter) <= 25;
  if (isFlat && winPctLoss <= 1) return 'good';

  // Great: not engine top, but found a strong move in a losing/critical position.
  // Matches Chess.com: "moves critical to the outcome — going from losing to equal,
  // or finding the only good move in a difficult position."
  if (winPctLoss <= 2) {
    const winBefore = color === 'w' ? cpToWinPct(cpBefore) : cpToWinPct(-cpBefore);
    if (winBefore <= 40) return 'great'; // found a near-best move when losing
  }

  // Win-percentage thresholds (aligned with Chess.com expected points model)
  if (winPctLoss <= 2) return 'excellent';
  if (winPctLoss <= 5) return 'good';
  if (winPctLoss <= 10) return 'inaccuracy';
  if (winPctLoss <= 20) return 'mistake';
  return 'blunder';
}

/** Convert a UCI move (e.g. "e2e4") to SAN (e.g. "e4") given a FEN position. */
export function uciToSan(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion });
    return move ? move.san : null;
  } catch {
    return null;
  }
}

/** Evaluate all moves in a game. Requires an engine evaluate function. */
export async function evaluateGame(
  evaluateFn: (fen: string) => Promise<EngineEval>,
  moves: Array<{ fenBefore: string; fenAfter: string; san: string; from: string; to: string; color: PieceColor }>,
  onProgress?: (current: number, total: number) => void
): Promise<MoveEvaluation[]> {
  const evaluations: MoveEvaluation[] = [];

  // Determine book depth — moves that are still in the openings trie
  const sanMoves = moves.map((m) => m.san);
  const bookDepth = getBookDepth(sanMoves);

  // Cache: move[i].fenAfter === move[i+1].fenBefore, so reuse evalAfter as next evalBefore.
  // This halves the number of engine calls.
  let cachedEval: EngineEval | null = null;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];

    // Book moves: skip engine evaluation (and invalidate cache)
    if (i < bookDepth) {
      cachedEval = null;
      evaluations.push({
        moveIndex: i,
        san: move.san,
        color: move.color,
        evalBefore: null,
        evalAfter: null,
        classification: 'book',
        cpLoss: 0,
      });
      onProgress?.(i + 1, moves.length);
      continue;
    }

    const evalBefore = cachedEval ?? await evaluateFn(move.fenBefore);
    const evalAfter = await evaluateFn(move.fenAfter);
    cachedEval = evalAfter;

    const playedMoveUci = move.from + move.to;
    const cpLoss = computeCpLoss(evalBefore.score, evalAfter.score, move.color);
    const classification = classifyMove(evalBefore, evalAfter, playedMoveUci, evalBefore.bestMove, move.color);

    // For non-good moves, provide the engine's suggestion in SAN
    let engineSuggestionSan: string | undefined;
    if (['inaccuracy', 'mistake', 'blunder'].includes(classification)) {
      engineSuggestionSan = uciToSan(move.fenBefore, evalBefore.bestMove) ?? undefined;
    }

    evaluations.push({
      moveIndex: i,
      san: move.san,
      color: move.color,
      evalBefore,
      evalAfter,
      classification,
      cpLoss,
      engineSuggestionSan,
    });

    onProgress?.(i + 1, moves.length);
  }

  return evaluations;
}

/**
 * Evaluate all moves in a game using parallel engine workers.
 *
 * Strategy:
 * 1. Collect all unique FENs that need evaluation (skip book moves, deduplicate).
 *    Note: move[i].fenAfter === move[i+1].fenBefore, so deduplication preserves the cache optimization.
 * 2. Fire all evaluations in parallel via the pool.
 * 3. Once all results are back, classify moves sequentially (classification is synchronous).
 */
export async function evaluateGameParallel(
  pool: EnginePool,
  moves: Array<{ fenBefore: string; fenAfter: string; san: string; from: string; to: string; color: PieceColor }>,
  options?: EvaluateOptions,
  onProgress?: (current: number, total: number) => void
): Promise<MoveEvaluation[]> {
  const sanMoves = moves.map((m) => m.san);
  const bookDepth = getBookDepth(sanMoves);

  // Collect unique FENs that need evaluation
  const fenSet = new Set<string>();
  for (let i = bookDepth; i < moves.length; i++) {
    fenSet.add(moves[i].fenBefore);
    fenSet.add(moves[i].fenAfter);
  }

  const uniqueFens = Array.from(fenSet);

  // Evaluate all positions in parallel
  const evalMap = await pool.evaluateAll(uniqueFens, options, onProgress);

  // Classify moves sequentially using the precomputed evaluations
  const evaluations: MoveEvaluation[] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];

    if (i < bookDepth) {
      evaluations.push({
        moveIndex: i,
        san: move.san,
        color: move.color,
        evalBefore: null,
        evalAfter: null,
        classification: 'book',
        cpLoss: 0,
      });
      continue;
    }

    const evalBefore = evalMap.get(move.fenBefore)!;
    const evalAfter = evalMap.get(move.fenAfter)!;

    const playedMoveUci = move.from + move.to;
    const cpLoss = computeCpLoss(evalBefore.score, evalAfter.score, move.color);
    const classification = classifyMove(evalBefore, evalAfter, playedMoveUci, evalBefore.bestMove, move.color);

    let engineSuggestionSan: string | undefined;
    if (['inaccuracy', 'mistake', 'blunder'].includes(classification)) {
      engineSuggestionSan = uciToSan(move.fenBefore, evalBefore.bestMove) ?? undefined;
    }

    evaluations.push({
      moveIndex: i,
      san: move.san,
      color: move.color,
      evalBefore,
      evalAfter,
      classification,
      cpLoss,
      engineSuggestionSan,
    });
  }

  return evaluations;
}
