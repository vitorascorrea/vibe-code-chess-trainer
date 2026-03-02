import { Chessboard, COLOR, INPUT_EVENT_TYPE, FEN } from 'cm-chessboard';
import { Arrows, ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows.js';
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers.js';
import { bus, state } from './state';
import type { GameManager } from './game-manager';

export class BoardController {
  private board: Chessboard | null = null;
  private gm: GameManager;

  constructor(gm: GameManager) {
    this.gm = gm;
  }

  async mount(container: HTMLElement): Promise<void> {
    this.board = new Chessboard(container, {
      position: FEN.start,
      orientation: COLOR.white,
      responsive: true,
      assetsUrl: `${import.meta.env.BASE_URL}assets/`,
      style: {
        cssClass: 'default',
        showCoordinates: true,
        borderType: 'none' as unknown as undefined,
      },
      extensions: [
        { class: Arrows, props: { sprite: 'extensions/arrows/arrows.svg' } },
        { class: Markers, props: { sprite: 'extensions/markers/markers.svg', autoMarkers: null } },
      ],
    });

    bus.on('position:changed', () => {
      this.syncPosition();
      this.drawArrows();
    });
    bus.on('game:loaded', () => this.onGameLoaded());
    bus.on('mode:changed', () => this.updateInput());
    bus.on('eval:complete', () => {
      this.drawArrows();
      this.updateInput();
    });
    bus.on('eval:started', () => this.lockBoard());
    bus.on('eval:progress', () => this.lockBoard());
  }

  destroy(): void {
    if (this.board) {
      this.board.destroy();
      this.board = null;
    }
  }

  flip(): void {
    if (!this.board) return;
    state.boardFlipped = !state.boardFlipped;
    this.board.setOrientation(state.boardFlipped ? COLOR.black : COLOR.white, true);
  }

  private onGameLoaded(): void {
    if (!this.board || !state.game) return;
    if (state.game.userColor === 'b') {
      state.boardFlipped = true;
      this.board.setOrientation(COLOR.black, false);
    } else {
      state.boardFlipped = false;
      this.board.setOrientation(COLOR.white, false);
    }
    this.syncPosition();
    this.updateInput();
  }

  private syncPosition(): void {
    if (!this.board) return;
    this.board.setPosition(this.gm.currentFen, true);
  }

  private drawArrows(): void {
    if (!this.board) return;
    this.board.removeArrows?.();
    this.board.removeMarkers?.();

    const idx = state.currentMoveIndex;
    if (idx < 0 || !state.game) return;

    const move = state.game.moves[idx];

    // Highlight last move squares
    this.board.addMarker?.(MARKER_TYPE.square, move.from);
    this.board.addMarker?.(MARKER_TYPE.square, move.to);

    // Show engine best move arrow if evaluated
    const ev = state.evaluations[idx];
    if (ev && ev.evalBefore) {
      const bestUci = ev.evalBefore.bestMove;
      if (bestUci && bestUci.length >= 4) {
        const from = bestUci.slice(0, 2);
        const to = bestUci.slice(2, 4);
        // Green arrow for engine best move
        this.board.addArrow?.(ARROW_TYPE.default, from, to);
      }
    }
  }

  private lockBoard(): void {
    if (!this.board) return;
    this.board.disableMoveInput();
  }

  private clearLegalMoveMarkers(): void {
    this.board?.removeMarkers?.(MARKER_TYPE.dot);
    this.board?.removeMarkers?.(MARKER_TYPE.bevel);
  }

  private updateInput(): void {
    if (!this.board) return;
    this.board.disableMoveInput();

    // Don't allow interaction during evaluation
    if (state.isEvaluating) return;

    if (state.mode === 'freeplay') {
      this.board.enableMoveInput((event: { type: string; squareFrom: string; squareTo: string }) => {
        if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
          this.clearLegalMoveMarkers();
          const legal = this.gm.legalMoves().filter(m => m.from === event.squareFrom);
          for (const m of legal) {
            this.board!.addMarker?.(m.captured ? MARKER_TYPE.bevel : MARKER_TYPE.dot, m.to);
          }
          return true;
        }
        if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
          return this.gm.freeplayMove(event.squareFrom, event.squareTo);
        }
        if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
          this.clearLegalMoveMarkers();
          bus.emit('position:changed');
        }
        if (event.type === INPUT_EVENT_TYPE.moveInputCanceled) {
          this.clearLegalMoveMarkers();
        }
        return true;
      });
    }
  }
}
