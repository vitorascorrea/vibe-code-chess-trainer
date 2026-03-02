import type { MoveEvaluation, MoveClassification, GameData, PieceColor } from './types';

export interface TrainerMessage {
  moveIndex: number;     // -1 for game-level messages
  type: 'opening' | 'move' | 'pattern' | 'summary' | 'encouragement';
  text: string;
  classification?: MoveClassification;
}

// ── Template pools (pick randomly for variety) ──

const BEST_TEMPLATES = [
  (san: string) => `You played ${san} -- the engine's top choice. Sharp eyes!`,
  (san: string) => `${san} was the best move here. Well done.`,
  (san: string) => `Spot on with ${san}. That's exactly what the engine wanted.`,
  (san: string) => `${san} -- perfect. You matched the engine's first line.`,
];

const EXCELLENT_TEMPLATES = [
  (san: string) => `${san} is an excellent move. Very close to the engine's top pick.`,
  (san: string) => `Strong choice with ${san}. Barely any difference from the best line.`,
  (san: string) => `${san} -- near-perfect play here.`,
];

const GREAT_TEMPLATES = [
  (san: string) => `Great find with ${san}! Finding a strong move in a tough position is a real skill.`,
  (san: string) => `${san} was a great move -- you kept your head when the position was difficult.`,
  (san: string) => `Impressive resilience. ${san} was exactly the kind of move you needed here.`,
];

const GOOD_TEMPLATES = [
  (san: string) => `${san} is a solid, practical move.`,
  (san: string) => `${san} -- reasonable. Nothing wrong with this.`,
  (san: string) => `A steady move with ${san}. Keeps things in order.`,
];

const BRILLIANT_TEMPLATES = [
  (san: string) => `Brilliant! ${san} involves a sacrifice and still improves your position. Creative play.`,
  (san: string) => `${san} is a brilliant sacrifice. Not the engine's top pick, but the position swings in your favor.`,
];

const INACCURACY_TEMPLATES = [
  (san: string, suggestion?: string) =>
    `${san} is a small inaccuracy.${suggestion ? ` The engine preferred ${suggestion}.` : ''} Not a big deal, but worth noting.`,
  (san: string, suggestion?: string) =>
    `Slight slip with ${san}.${suggestion ? ` ${suggestion} was a bit more precise.` : ''}`,
  (san: string, suggestion?: string) =>
    `${san} was an inaccuracy.${suggestion ? ` Consider ${suggestion} next time -- it keeps more tension.` : ''}`,
];

const MISTAKE_TEMPLATES = [
  (san: string, suggestion?: string) =>
    `${san} is a mistake -- this costs some material or positional value.${suggestion ? ` The engine wanted ${suggestion}.` : ''}`,
  (san: string, suggestion?: string) =>
    `Careful with ${san}.${suggestion ? ` ${suggestion} was much stronger here.` : ''} This gave your opponent real chances.`,
  (san: string, suggestion?: string) =>
    `${san} was a mistake.${suggestion ? ` ${suggestion} would have maintained the advantage.` : ''}`,
];

const BLUNDER_TEMPLATES = [
  (san: string, cpLoss: number, suggestion?: string) =>
    `${san} is a blunder (${formatCpLoss(cpLoss)} lost).${suggestion ? ` The engine strongly preferred ${suggestion}.` : ''} Look for tactical threats before committing.`,
  (san: string, cpLoss: number, suggestion?: string) =>
    `Ouch -- ${san} drops ${formatCpLoss(cpLoss)}.${suggestion ? ` ${suggestion} was the move to find here.` : ''} Take an extra moment to scan for danger.`,
  (san: string, cpLoss: number, suggestion?: string) =>
    `${san} is a serious blunder.${suggestion ? ` ${suggestion} keeps the game in hand.` : ''} Always check: "What can my opponent do after this?"`,
];

const OPENING_TEMPLATES = [
  (name: string) => `You're playing the ${name}. A classic choice!`,
  (name: string) => `This is the ${name}. Let's see how the middlegame unfolds.`,
  (name: string) => `The ${name} -- solid opening. Theory runs deep here.`,
];

// ── Helpers ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatCpLoss(cp: number): string {
  const pawns = (cp / 100).toFixed(1);
  return `~${pawns} pawns`;
}

function colorName(color: PieceColor): string {
  return color === 'w' ? 'White' : 'Black';
}

function countByClassification(evals: MoveEvaluation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of evals) {
    counts[e.classification] = (counts[e.classification] || 0) + 1;
  }
  return counts;
}

function phaseLabel(moveIndex: number, totalMoves: number): string {
  const ratio = moveIndex / totalMoves;
  if (ratio < 0.25) return 'opening';
  if (ratio < 0.65) return 'middlegame';
  return 'endgame';
}

// ── Public API ──

/**
 * Generate all trainer messages for a completed evaluation.
 * Returns messages sorted by moveIndex (game-level messages at -1 come first).
 */
export function generateInsights(
  evaluations: MoveEvaluation[],
  game: GameData,
  openingName: string | null
): TrainerMessage[] {
  const messages: TrainerMessage[] = [];

  // Opening message
  if (openingName) {
    messages.push({
      moveIndex: -1,
      type: 'opening',
      text: pick(OPENING_TEMPLATES)(openingName),
    });
  }

  // Per-move messages (skip book moves and some "good" moves to avoid spam)
  for (const ev of evaluations) {
    const msg = generateMoveMessage(ev);
    if (msg) messages.push(msg);
  }

  // Pattern recognition
  const patterns = detectPatterns(evaluations, game);
  messages.push(...patterns);

  // Game summary
  messages.push(generateSummary(evaluations, game));

  return messages;
}

/**
 * Get messages relevant to a specific move index.
 * Returns game-level messages (moveIndex === -1) only when moveIndex is -1 (start position),
 * and move-specific messages for the given index.
 */
export function getMessagesForMove(
  allMessages: TrainerMessage[],
  moveIndex: number
): TrainerMessage[] {
  if (moveIndex === -1) {
    // At start position: show opening + summary
    return allMessages.filter(
      (m) => m.moveIndex === -1 || m.type === 'summary'
    );
  }
  return allMessages.filter((m) => m.moveIndex === moveIndex);
}

// ── Move message generation ──

function generateMoveMessage(ev: MoveEvaluation): TrainerMessage | null {
  switch (ev.classification) {
    case 'book':
      return null; // Don't comment on book moves

    case 'brilliant':
      return {
        moveIndex: ev.moveIndex,
        type: 'encouragement',
        text: pick(BRILLIANT_TEMPLATES)(ev.san),
        classification: 'brilliant',
      };

    case 'great':
      return {
        moveIndex: ev.moveIndex,
        type: 'encouragement',
        text: pick(GREAT_TEMPLATES)(ev.san),
        classification: 'great',
      };

    case 'best':
      return {
        moveIndex: ev.moveIndex,
        type: 'encouragement',
        text: pick(BEST_TEMPLATES)(ev.san),
        classification: 'best',
      };

    case 'excellent':
      return {
        moveIndex: ev.moveIndex,
        type: 'move',
        text: pick(EXCELLENT_TEMPLATES)(ev.san),
        classification: 'excellent',
      };

    case 'good':
      // Only comment on some good moves to reduce noise
      if (Math.random() > 0.4) return null;
      return {
        moveIndex: ev.moveIndex,
        type: 'move',
        text: pick(GOOD_TEMPLATES)(ev.san),
        classification: 'good',
      };

    case 'inaccuracy':
      return {
        moveIndex: ev.moveIndex,
        type: 'move',
        text: pick(INACCURACY_TEMPLATES)(ev.san, ev.engineSuggestionSan),
        classification: 'inaccuracy',
      };

    case 'mistake':
      return {
        moveIndex: ev.moveIndex,
        type: 'move',
        text: pick(MISTAKE_TEMPLATES)(ev.san, ev.engineSuggestionSan),
        classification: 'mistake',
      };

    case 'blunder':
      return {
        moveIndex: ev.moveIndex,
        type: 'move',
        text: pick(BLUNDER_TEMPLATES)(ev.san, ev.cpLoss, ev.engineSuggestionSan),
        classification: 'blunder',
      };

    default:
      return null;
  }
}

// ── Pattern detection ──

function detectPatterns(evaluations: MoveEvaluation[], game: GameData): TrainerMessage[] {
  const patterns: TrainerMessage[] = [];

  // Consecutive blunders/mistakes
  let streak = 0;
  let streakStart = -1;
  for (const ev of evaluations) {
    if (ev.classification === 'blunder' || ev.classification === 'mistake') {
      if (streak === 0) streakStart = ev.moveIndex;
      streak++;
    } else {
      if (streak >= 2) {
        patterns.push({
          moveIndex: streakStart,
          type: 'pattern',
          text: `You had ${streak} consecutive poor moves starting here. When things go wrong, take a breath and reassess the position before playing.`,
        });
      }
      streak = 0;
    }
  }
  if (streak >= 2) {
    patterns.push({
      moveIndex: streakStart,
      type: 'pattern',
      text: `You had ${streak} consecutive poor moves starting here. When things go wrong, take a breath and reassess the position before playing.`,
    });
  }

  // Strong streak (3+ best/excellent in a row)
  let goodStreak = 0;
  let goodStreakEnd = -1;
  for (const ev of evaluations) {
    if (['best', 'excellent', 'brilliant', 'great'].includes(ev.classification)) {
      goodStreak++;
      goodStreakEnd = ev.moveIndex;
    } else {
      if (goodStreak >= 3) {
        patterns.push({
          moveIndex: goodStreakEnd,
          type: 'encouragement',
          text: `Impressive -- ${goodStreak} strong moves in a row! Your calculation was on point in this stretch.`,
        });
      }
      goodStreak = 0;
    }
  }
  if (goodStreak >= 3) {
    patterns.push({
      moveIndex: goodStreakEnd,
      type: 'encouragement',
      text: `Impressive -- ${goodStreak} strong moves in a row! Your calculation was on point in this stretch.`,
    });
  }

  return patterns;
}

// ── Game summary ──

function generateSummary(evaluations: MoveEvaluation[], game: GameData): TrainerMessage {
  const counts = countByClassification(evaluations);
  const total = evaluations.length;

  // Phase analysis: find which phase had the most errors
  const phaseErrors: Record<string, number> = { opening: 0, middlegame: 0, endgame: 0 };
  for (const ev of evaluations) {
    if (['inaccuracy', 'mistake', 'blunder'].includes(ev.classification)) {
      const phase = phaseLabel(ev.moveIndex, total);
      phaseErrors[phase]++;
    }
  }

  const worstPhase = Object.entries(phaseErrors).sort((a, b) => b[1] - a[1])[0];
  const bestPhase = Object.entries(phaseErrors).sort((a, b) => a[1] - b[1])[0];

  const parts: string[] = [];

  // Classification summary
  const summaryParts: string[] = [];
  if (counts.brilliant) summaryParts.push(`${counts.brilliant} brilliant`);
  if (counts.great) summaryParts.push(`${counts.great} great`);
  if (counts.best) summaryParts.push(`${counts.best} best`);
  if (counts.inaccuracy) summaryParts.push(`${counts.inaccuracy} inaccuracy${counts.inaccuracy > 1 ? '' : ''}`);
  if (counts.mistake) summaryParts.push(`${counts.mistake} mistake${counts.mistake > 1 ? 's' : ''}`);
  if (counts.blunder) summaryParts.push(`${counts.blunder} blunder${counts.blunder > 1 ? 's' : ''}`);

  if (summaryParts.length > 0) {
    parts.push(`Game summary: ${summaryParts.join(', ')}.`);
  }

  // Phase insight
  if (worstPhase[1] > 0 && bestPhase[0] !== worstPhase[0]) {
    parts.push(`Your ${bestPhase[0]} was the cleanest. Watch out for errors in the ${worstPhase[0]}.`);
  }

  // Accuracy percentage (best + excellent + great + brilliant + good + book) / total
  const accurate = (counts.best || 0) + (counts.excellent || 0) + (counts.great || 0) +
    (counts.brilliant || 0) + (counts.good || 0) + (counts.book || 0);
  const accuracy = total > 0 ? Math.round((accurate / total) * 100) : 0;
  parts.push(`Overall accuracy: ${accuracy}%.`);

  // Result context
  const result = game.headers.result;
  if (result === '1-0') {
    parts.push(game.userColor === 'w' ? 'Nice win!' : 'Tough loss -- review the key moments above.');
  } else if (result === '0-1') {
    parts.push(game.userColor === 'b' ? 'Nice win!' : 'Tough loss -- review the key moments above.');
  } else {
    parts.push('A draw -- look for moments where you could have pushed for more.');
  }

  return {
    moveIndex: -1,
    type: 'summary',
    text: parts.join(' '),
  };
}
