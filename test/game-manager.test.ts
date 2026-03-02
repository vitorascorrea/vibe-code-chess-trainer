import { describe, it, expect, beforeEach } from 'vitest';
import { GameManager } from '../src/game-manager';
import { SAMPLE_PGN, SAMPLE_PGN_WITH_CLOCKS, SINGLE_LINE_PGN, SHORT_PGN, DRAW_PGN, EVAL_ANNOTATED_PGN } from './fixtures/sample-games';

describe('GameManager', () => {
  let gm: GameManager;

  describe('PGN parsing', () => {
    it('parses chess.com PGN format', () => {
      gm = new GameManager();
      const game = gm.loadPgn(SAMPLE_PGN);

      expect(game.headers.white).toBe('TheOne12131');
      expect(game.headers.black).toBe('correasam');
      expect(game.headers.whiteElo).toBe(408);
      expect(game.headers.blackElo).toBe(461);
      expect(game.headers.result).toBe('0-1');
      expect(game.headers.date).toBe('2026-02-28');
      expect(game.headers.timeControl).toBe('600');
      expect(game.headers.termination).toBe('correasam won by checkmate');
    });

    it('extracts all moves with FEN at each position', () => {
      gm = new GameManager();
      const game = gm.loadPgn(SAMPLE_PGN);

      // 18 full moves = 36 half-moves
      expect(game.moves.length).toBe(36);
      expect(game.moves[0].san).toBe('e3');
      expect(game.moves[0].color).toBe('w');
      expect(game.moves[1].san).toBe('e5');
      expect(game.moves[1].color).toBe('b');

      // Last move is checkmate
      expect(game.moves[35].san).toBe('Qd5#');

      // Every move should have valid FEN
      for (const move of game.moves) {
        expect(move.fenBefore).toBeTruthy();
        expect(move.fenAfter).toBeTruthy();
        expect(move.fenBefore).not.toBe(move.fenAfter);
      }
    });

    it('defaults userColor to white', () => {
      gm = new GameManager();
      const game = gm.loadPgn(SAMPLE_PGN);
      expect(game.userColor).toBe('w');
    });

    it('userColor can be changed after loading', () => {
      gm = new GameManager();
      const game = gm.loadPgn(SAMPLE_PGN);
      game.userColor = 'b';
      expect(game.userColor).toBe('b');
    });

    it('handles PGNs with clock annotations', () => {
      gm = new GameManager();
      const game = gm.loadPgn(SAMPLE_PGN_WITH_CLOCKS);

      expect(game.moves.length).toBe(36);
      expect(game.moves[0].clock).toBe('0:09:57.6');
      expect(game.moves[1].clock).toBe('0:09:56.9');
    });

    it('handles PGNs with eval annotations', () => {
      gm = new GameManager();
      const game = gm.loadPgn(EVAL_ANNOTATED_PGN);

      expect(game.moves[0].evalAnnotation).toBe(0.2);
      expect(game.moves[1].evalAnnotation).toBe(0.1);
    });

    it('handles games ending in checkmate', () => {
      gm = new GameManager();
      const game = gm.loadPgn(SAMPLE_PGN);

      const lastMove = game.moves[game.moves.length - 1];
      expect(lastMove.san).toBe('Qd5#');
      expect(game.headers.result).toBe('0-1');
    });

    it('handles games ending in draw', () => {
      gm = new GameManager();
      const game = gm.loadPgn(DRAW_PGN);
      expect(game.headers.result).toBe('1/2-1/2');
    });

    it('parses single-line PGN (chess.com copy-paste format)', () => {
      gm = new GameManager();
      const game = gm.loadPgn(SINGLE_LINE_PGN);

      expect(game.headers.white).toBe('TheOne12131');
      expect(game.headers.black).toBe('correasam');
      expect(game.moves.length).toBe(36);
      expect(game.moves[35].san).toBe('Qd5#');
      expect(game.userColor).toBe('w'); // defaults to white
    });

    it('stores from/to squares for each move', () => {
      gm = new GameManager();
      const game = gm.loadPgn(SHORT_PGN);

      expect(game.moves[0].from).toBe('e2');
      expect(game.moves[0].to).toBe('e4');
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      gm = new GameManager();
      gm.loadPgn(SHORT_PGN); // 7 half-moves (1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#)
    });

    it('starts at position before first move', () => {
      expect(gm.currentMoveIndex).toBe(-1);
    });

    it('forward() advances to next move', () => {
      gm.forward();
      expect(gm.currentMoveIndex).toBe(0);
      expect(gm.currentFen).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
    });

    it('backward() goes to previous move', () => {
      gm.forward();
      gm.forward();
      gm.backward();
      expect(gm.currentMoveIndex).toBe(0);
    });

    it('backward() at start does nothing', () => {
      gm.backward();
      expect(gm.currentMoveIndex).toBe(-1);
    });

    it('forward() at end does nothing', () => {
      for (let i = 0; i < 20; i++) gm.forward();
      const idx = gm.currentMoveIndex;
      gm.forward();
      expect(gm.currentMoveIndex).toBe(idx);
    });

    it('goToMove(n) jumps to specific move', () => {
      gm.goToMove(3);
      expect(gm.currentMoveIndex).toBe(3);
    });

    it('goToStart() returns to initial position', () => {
      gm.forward();
      gm.forward();
      gm.goToStart();
      expect(gm.currentMoveIndex).toBe(-1);
    });

    it('goToEnd() goes to final position', () => {
      gm.goToEnd();
      expect(gm.currentMoveIndex).toBe(6); // 7 half-moves, 0-indexed
    });

    it('currentFen returns starting position when at index -1', () => {
      expect(gm.currentFen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    });
  });

  describe('freeplay', () => {
    beforeEach(() => {
      gm = new GameManager();
      gm.loadPgn(SHORT_PGN);
      gm.goToMove(1); // after 1. e4 e5
    });

    it('enterFreeplay() switches to freeplay mode', () => {
      gm.enterFreeplay();
      expect(gm.mode).toBe('freeplay');
    });

    it('allows making legal moves in freeplay', () => {
      gm.enterFreeplay();
      const result = gm.freeplayMove('d2', 'd4');
      expect(result).toBe(true);
    });

    it('rejects illegal moves in freeplay', () => {
      gm.enterFreeplay();
      const result = gm.freeplayMove('e2', 'e4'); // pawn already on e4
      expect(result).toBe(false);
    });

    it('allows moves for both colors in freeplay', () => {
      gm.enterFreeplay();
      gm.freeplayMove('d2', 'd4'); // white
      gm.freeplayMove('d7', 'd5'); // black
      expect(gm.mode).toBe('freeplay');
    });

    it('resumePgn() returns to branch point', () => {
      gm.enterFreeplay();
      gm.freeplayMove('d2', 'd4');
      gm.freeplayMove('d7', 'd5');
      gm.resumePgn();

      expect(gm.mode).toBe('review');
      expect(gm.currentMoveIndex).toBe(1);
    });
  });

  describe('legal moves', () => {
    it('returns legal moves for current position', () => {
      gm = new GameManager();
      gm.loadPgn(SHORT_PGN);
      const moves = gm.legalMoves();
      expect(moves.length).toBe(20); // 20 legal first moves
    });
  });
});
