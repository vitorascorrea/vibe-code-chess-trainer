import { describe, it, expect } from 'vitest';
import { generateInsights, getMessagesForMove } from '../src/trainer';
import type { TrainerMessage } from '../src/trainer';
import type { MoveEvaluation, GameData, EngineEval, EngineScore, PieceColor } from '../src/types';

// ── Helpers ──

function cp(value: number): EngineScore {
  return { type: 'cp', value };
}

function makeEval(score: EngineScore, bestMove = 'e2e4'): EngineEval {
  return { score, bestMove, depth: 20, pv: [bestMove] };
}

function makeMoveEval(overrides: Partial<MoveEvaluation> & { moveIndex: number }): MoveEvaluation {
  return {
    san: 'e4',
    color: 'w' as PieceColor,
    evalBefore: makeEval(cp(50)),
    evalAfter: makeEval(cp(50)),
    classification: 'best',
    cpLoss: 0,
    ...overrides,
  };
}

function makeGame(overrides?: Partial<GameData>): GameData {
  return {
    headers: {
      white: 'Player1',
      black: 'Player2',
      whiteElo: 1500,
      blackElo: 1500,
      result: '1-0',
      date: '2026.01.01',
      event: 'Test',
      timeControl: '600',
      termination: 'Player1 won by checkmate',
    },
    moves: [],
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    userColor: 'w',
    ...overrides,
  };
}

// ── Tests ──

describe('generateInsights', () => {
  it('generates an opening message when opening is provided', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, san: 'e4', classification: 'book' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, 'Sicilian Defense');

    const openingMsgs = messages.filter((m) => m.type === 'opening');
    expect(openingMsgs.length).toBe(1);
    expect(openingMsgs[0].text).toContain('Sicilian Defense');
    expect(openingMsgs[0].moveIndex).toBe(-1);
  });

  it('does not generate an opening message when opening is null', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, san: 'e4', classification: 'book' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const openingMsgs = messages.filter((m) => m.type === 'opening');
    expect(openingMsgs.length).toBe(0);
  });

  it('always generates a summary message', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, san: 'e4', classification: 'best' }),
      makeMoveEval({ moveIndex: 1, san: 'e5', color: 'b', classification: 'best' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const summaryMsgs = messages.filter((m) => m.type === 'summary');
    expect(summaryMsgs.length).toBe(1);
    expect(summaryMsgs[0].moveIndex).toBe(-1);
  });

  it('generates move commentary for blunders with engine suggestion', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({
        moveIndex: 0,
        san: 'Ke2',
        classification: 'blunder',
        cpLoss: 300,
        engineSuggestionSan: 'Nf3',
      }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const moveMsgs = messages.filter((m) => m.moveIndex === 0);
    expect(moveMsgs.length).toBeGreaterThanOrEqual(1);
    const blunderMsg = moveMsgs.find((m) => m.classification === 'blunder');
    expect(blunderMsg).toBeDefined();
    expect(blunderMsg!.text).toContain('Ke2');
    expect(blunderMsg!.text).toContain('Nf3');
  });

  it('generates move commentary for mistakes with engine suggestion', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({
        moveIndex: 0,
        san: 'h3',
        classification: 'mistake',
        cpLoss: 150,
        engineSuggestionSan: 'Nf3',
      }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const moveMsgs = messages.filter((m) => m.moveIndex === 0 && m.classification === 'mistake');
    expect(moveMsgs.length).toBe(1);
    expect(moveMsgs[0].text).toContain('h3');
  });

  it('generates encouragement for best moves', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, san: 'Nf3', classification: 'best' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const bestMsgs = messages.filter((m) => m.classification === 'best');
    expect(bestMsgs.length).toBeGreaterThanOrEqual(1);
    expect(bestMsgs[0].text).toContain('Nf3');
  });

  it('generates encouragement for brilliant moves', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, san: 'Bxf7+', classification: 'brilliant' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const brilliantMsgs = messages.filter((m) => m.classification === 'brilliant');
    expect(brilliantMsgs.length).toBe(1);
    expect(brilliantMsgs[0].text).toContain('Bxf7+');
    expect(brilliantMsgs[0].type).toBe('encouragement');
  });

  it('generates encouragement for great moves', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, san: 'Qd5', classification: 'great' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const greatMsgs = messages.filter((m) => m.classification === 'great');
    expect(greatMsgs.length).toBe(1);
    expect(greatMsgs[0].type).toBe('encouragement');
  });

  it('generates inaccuracy commentary', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({
        moveIndex: 0,
        san: 'a3',
        classification: 'inaccuracy',
        engineSuggestionSan: 'd4',
      }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const inaccMsgs = messages.filter((m) => m.classification === 'inaccuracy');
    expect(inaccMsgs.length).toBe(1);
    expect(inaccMsgs[0].text).toContain('a3');
  });

  it('skips book moves', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, san: 'e4', classification: 'book' }),
      makeMoveEval({ moveIndex: 1, san: 'e5', color: 'b', classification: 'book' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    // No move-specific messages for book moves (only summary)
    const bookMoveMsgs = messages.filter((m) => m.moveIndex >= 0);
    expect(bookMoveMsgs.length).toBe(0);
  });

  it('summary contains accuracy percentage', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, classification: 'best' }),
      makeMoveEval({ moveIndex: 1, classification: 'best', color: 'b' }),
      makeMoveEval({ moveIndex: 2, classification: 'blunder', cpLoss: 300 }),
      makeMoveEval({ moveIndex: 3, classification: 'best', color: 'b' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const summary = messages.find((m) => m.type === 'summary');
    expect(summary).toBeDefined();
    expect(summary!.text).toContain('accuracy');
    expect(summary!.text).toContain('75%'); // 3/4 are best
  });

  it('summary mentions result context for a win', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, classification: 'best' }),
    ];
    const game = makeGame({ headers: { ...makeGame().headers, result: '1-0' } });
    game.userColor = 'w';
    const messages = generateInsights(evals, game, null);

    const summary = messages.find((m) => m.type === 'summary');
    expect(summary!.text).toContain('Nice win');
  });

  it('summary mentions result context for a loss', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, classification: 'blunder', cpLoss: 300 }),
    ];
    const game = makeGame({ headers: { ...makeGame().headers, result: '0-1' } });
    game.userColor = 'w';
    const messages = generateInsights(evals, game, null);

    const summary = messages.find((m) => m.type === 'summary');
    expect(summary!.text).toContain('Tough loss');
  });

  it('summary mentions result context for a draw', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, classification: 'best' }),
    ];
    const game = makeGame({ headers: { ...makeGame().headers, result: '1/2-1/2' } });
    const messages = generateInsights(evals, game, null);

    const summary = messages.find((m) => m.type === 'summary');
    expect(summary!.text).toContain('draw');
  });
});

describe('generateInsights — pattern detection', () => {
  it('detects consecutive blunder streak', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, classification: 'best' }),
      makeMoveEval({ moveIndex: 1, classification: 'blunder', cpLoss: 300, color: 'b' }),
      makeMoveEval({ moveIndex: 2, classification: 'mistake', cpLoss: 150 }),
      makeMoveEval({ moveIndex: 3, classification: 'best', color: 'b' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const patternMsgs = messages.filter((m) => m.type === 'pattern');
    expect(patternMsgs.length).toBeGreaterThanOrEqual(1);
    expect(patternMsgs[0].text).toContain('consecutive poor moves');
  });

  it('detects strong move streak (3+ best/excellent)', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, classification: 'best' }),
      makeMoveEval({ moveIndex: 1, classification: 'excellent', color: 'b' }),
      makeMoveEval({ moveIndex: 2, classification: 'best' }),
      makeMoveEval({ moveIndex: 3, classification: 'good', color: 'b' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const encourageMsgs = messages.filter(
      (m) => m.type === 'encouragement' && m.text.includes('strong moves in a row')
    );
    expect(encourageMsgs.length).toBe(1);
    expect(encourageMsgs[0].text).toContain('3');
  });

  it('does not detect patterns when none exist', () => {
    const evals: MoveEvaluation[] = [
      makeMoveEval({ moveIndex: 0, classification: 'best' }),
      makeMoveEval({ moveIndex: 1, classification: 'good', color: 'b' }),
      makeMoveEval({ moveIndex: 2, classification: 'best' }),
    ];
    const game = makeGame();
    const messages = generateInsights(evals, game, null);

    const patternMsgs = messages.filter((m) => m.type === 'pattern');
    expect(patternMsgs.length).toBe(0);
  });
});

describe('getMessagesForMove', () => {
  const allMessages: TrainerMessage[] = [
    { moveIndex: -1, type: 'opening', text: 'Sicilian Defense' },
    { moveIndex: -1, type: 'summary', text: 'Game summary...' },
    { moveIndex: 0, type: 'encouragement', text: 'Great move!', classification: 'best' },
    { moveIndex: 1, type: 'move', text: 'A mistake.', classification: 'mistake' },
    { moveIndex: 2, type: 'move', text: 'Solid move.' },
    { moveIndex: 1, type: 'pattern', text: 'Pattern detected.' },
  ];

  it('returns opening + summary for start position (moveIndex = -1)', () => {
    const msgs = getMessagesForMove(allMessages, -1);
    expect(msgs.length).toBe(2);
    expect(msgs.some((m) => m.type === 'opening')).toBe(true);
    expect(msgs.some((m) => m.type === 'summary')).toBe(true);
  });

  it('returns messages for a specific move index', () => {
    const msgs = getMessagesForMove(allMessages, 1);
    expect(msgs.length).toBe(2);
    expect(msgs.every((m) => m.moveIndex === 1)).toBe(true);
  });

  it('returns empty array when no messages for a move', () => {
    const msgs = getMessagesForMove(allMessages, 5);
    expect(msgs.length).toBe(0);
  });

  it('returns messages for move 0', () => {
    const msgs = getMessagesForMove(allMessages, 0);
    expect(msgs.length).toBe(1);
    expect(msgs[0].text).toBe('Great move!');
  });
});
