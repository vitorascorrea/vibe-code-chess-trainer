import { Chess, Move } from 'chess.js';
import type { GameData, GameHeaders, MoveData, PieceColor, AppMode } from './types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export class GameManager {
  private game: GameData | null = null;
  private chess: Chess;
  private freeplayChess: Chess | null = null;
  private _currentMoveIndex = -1;
  private _mode: AppMode = 'review';
  private _freeplayBranchPoint = -1;
  private _freeplayMoveCount = 0;

  constructor() {
    this.chess = new Chess();
  }

  loadPgn(pgn: string): GameData {
    this.chess = new Chess();
    const normalized = this.normalizePgn(pgn);
    const cleanPgn = this.stripAnnotations(normalized);
    this.chess.loadPgn(cleanPgn);

    const headers = this.parseHeaders(this.chess.header() as unknown as Record<string, string>);
    const moves = this.extractMoves(normalized, cleanPgn);

    this.game = {
      headers,
      moves,
      startFen: START_FEN,
      userColor: 'w',
    };

    this._currentMoveIndex = -1;
    this._mode = 'review';
    this._freeplayBranchPoint = -1;
    this.freeplayChess = null;

    return this.game;
  }

  private parseHeaders(raw: Record<string, string>): GameHeaders {
    return {
      white: raw['White'] || '',
      black: raw['Black'] || '',
      whiteElo: parseInt(raw['WhiteElo'] || '0', 10),
      blackElo: parseInt(raw['BlackElo'] || '0', 10),
      result: raw['Result'] || '',
      date: raw['Date'] || '',
      event: raw['Event'] || '',
      timeControl: raw['TimeControl'] || '',
      termination: raw['Termination'] || '',
    };
  }

  private extractMoves(rawPgn: string, cleanPgn: string): MoveData[] {
    // Parse annotations from raw PGN text
    const annotations = this.parseAnnotations(rawPgn);

    // Replay the game move by move to capture FEN at each position
    const replay = new Chess();
    replay.loadPgn(cleanPgn);
    const history = replay.history({ verbose: true });

    // Now replay again step by step to get fenBefore
    const stepper = new Chess();
    const moves: MoveData[] = [];

    for (let i = 0; i < history.length; i++) {
      const fenBefore = stepper.fen();
      const move = stepper.move(history[i].san);
      if (!move) continue;
      const fenAfter = stepper.fen();

      moves.push({
        index: i,
        san: move.san,
        from: move.from,
        to: move.to,
        color: move.color as PieceColor,
        fenBefore,
        fenAfter,
        clock: annotations[i]?.clock,
        evalAnnotation: annotations[i]?.eval,
      });
    }

    return moves;
  }

  private parseAnnotations(pgn: string): Array<{ clock?: string; eval?: number }> {
    const annotations: Array<{ clock?: string; eval?: number }> = [];

    // Strip PGN header lines (lines starting with [)
    const moveSection = pgn.replace(/^\[.*\]$/gm, '').trim();

    // Match each move SAN followed by optional {annotation}
    // This regex captures: optional move number, SAN move, then optional annotation block
    const regex = /(?:\d+\.+\s*)?([KQRBNP]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O-O|O-O)(\s*\{[^}]*\})?/g;
    let match;
    let moveIndex = 0;

    while ((match = regex.exec(moveSection)) !== null) {
      const annotation = match[2] || '';
      const clkMatch = annotation.match(/\[%clk\s+([^\]]+)\]/);
      const evalMatch = annotation.match(/\[%eval\s+([^\]]+)\]/);

      annotations[moveIndex] = {
        clock: clkMatch ? clkMatch[1] : undefined,
        eval: evalMatch ? parseFloat(evalMatch[1]) : undefined,
      };
      moveIndex++;
    }

    return annotations;
  }

  /** Normalize PGN: fix common formatting issues from chess.com copy-paste. */
  private normalizePgn(pgn: string): string {
    // Split "][" into separate lines
    let out = pgn.replace(/\]\s*\[/g, ']\n[');
    // Ensure blank line between last header and move text
    out = out.replace(/\]\s*(\d+\.)/, ']\n\n$1');
    // Fix missing spaces: "Kd1Qxf3+" → "Kd1 Qxf3+"
    // Insert space between a move ending (letter/digit/+/#) and a new move starting (uppercase piece or pawn file)
    out = out.replace(/([a-h1-8+#])([KQRBNP][a-h]|[KQRBN][a-hx1-8]|[a-h]x[a-h])/g, '$1 $2');
    // Fix "8.Nxd4" → "8. Nxd4" (no space after move number dot)
    out = out.replace(/(\d+\.)([A-Za-z])/g, '$1 $2');
    return out;
  }

  private stripAnnotations(pgn: string): string {
    // Remove clock and eval annotations but keep the moves
    return pgn.replace(/\{[^}]*\}/g, '');
  }

  // Navigation
  get currentMoveIndex(): number {
    return this._currentMoveIndex;
  }

  get mode(): AppMode {
    return this._mode;
  }

  get freeplayBranchPoint(): number {
    return this._freeplayBranchPoint;
  }

  get currentFen(): string {
    if (this._mode === 'freeplay' && this.freeplayChess) {
      return this.freeplayChess.fen();
    }
    if (!this.game || this._currentMoveIndex < 0) return START_FEN;
    return this.game.moves[this._currentMoveIndex].fenAfter;
  }

  get currentGame(): GameData | null {
    return this.game;
  }

  forward(): void {
    if (!this.game) return;
    if (this._currentMoveIndex < this.game.moves.length - 1) {
      this._currentMoveIndex++;
    }
  }

  backward(): void {
    if (this._currentMoveIndex > -1) {
      this._currentMoveIndex--;
    }
  }

  goToMove(n: number): void {
    if (!this.game) return;
    this._currentMoveIndex = Math.max(-1, Math.min(n, this.game.moves.length - 1));
  }

  goToStart(): void {
    this._currentMoveIndex = -1;
  }

  goToEnd(): void {
    if (!this.game) return;
    this._currentMoveIndex = this.game.moves.length - 1;
  }

  // Freeplay
  enterFreeplay(): void {
    this._mode = 'freeplay';
    this._freeplayBranchPoint = this._currentMoveIndex;
    this._freeplayMoveCount = 0;
    this.freeplayChess = new Chess(this.currentFen);
  }

  freeplayMove(from: string, to: string, promotion?: string): MoveData | null {
    if (this._mode !== 'freeplay' || !this.freeplayChess) return null;
    try {
      const fenBefore = this.freeplayChess.fen();
      const move = this.freeplayChess.move({ from, to, promotion });
      if (!move) return null;
      const fenAfter = this.freeplayChess.fen();
      const halfMoveIndex = (this._freeplayBranchPoint + 1) + this._freeplayMoveCount;
      this._freeplayMoveCount++;
      return {
        index: halfMoveIndex,
        san: move.san,
        from: move.from,
        to: move.to,
        color: move.color as PieceColor,
        fenBefore,
        fenAfter,
      };
    } catch {
      return null;
    }
  }

  undoFreeplay(): boolean {
    if (this._mode !== 'freeplay' || !this.freeplayChess || this._freeplayMoveCount === 0) return false;
    this.freeplayChess.undo();
    this._freeplayMoveCount--;
    return true;
  }

  resumePgn(): void {
    this._mode = 'review';
    this._currentMoveIndex = this._freeplayBranchPoint;
    this._freeplayBranchPoint = -1;
    this._freeplayMoveCount = 0;
    this.freeplayChess = null;
  }

  legalMoves(): Move[] {
    if (this._mode === 'freeplay' && this.freeplayChess) {
      return this.freeplayChess.moves({ verbose: true }) as Move[];
    }
    const chess = new Chess(this.currentFen);
    return chess.moves({ verbose: true }) as Move[];
  }
}
