export type PieceColor = 'w' | 'b';

export interface GameHeaders {
  white: string;
  black: string;
  whiteElo: number;
  blackElo: number;
  result: string;
  date: string;
  event: string;
  timeControl: string;
  termination: string;
  [key: string]: string | number;
}

export interface MoveData {
  index: number;        // 0-based half-move index
  san: string;          // e.g. "e4"
  from: string;         // e.g. "e2"
  to: string;           // e.g. "e4"
  color: PieceColor;
  fenBefore: string;
  fenAfter: string;
  clock?: string;       // clock annotation if present
  evalAnnotation?: number; // eval annotation from PGN if present
}

export interface GameData {
  headers: GameHeaders;
  moves: MoveData[];
  startFen: string;
  userColor: PieceColor | null; // which side the user played
}

export type AppMode = 'review' | 'freeplay';

export interface EngineScore {
  type: 'cp' | 'mate';
  value: number; // centipawns or moves-to-mate (positive = white advantage)
}

export interface EngineEval {
  score: EngineScore;
  bestMove: string;     // UCI notation e.g. "e2e4"
  depth: number;
  pv: string[];         // principal variation in UCI
}

export type MoveClassification =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface MoveEvaluation {
  moveIndex: number;
  san: string;
  color: PieceColor;
  evalBefore: EngineEval | null;
  evalAfter: EngineEval | null;
  classification: MoveClassification;
  cpLoss: number;
  engineSuggestionSan?: string; // SAN of engine's best move (for non-good moves)
}

export interface StoredEvaluation {
  id: string;
  date: string;
  headers: GameHeaders;
  opening: string | null;
  pgn: string;
  evaluations: MoveEvaluation[];
  createdAt: number;
}

export interface Opening {
  eco: string;
  name: string;
  fen: string;
}

export type AppEvent =
  | 'game:loaded'
  | 'position:changed'
  | 'mode:changed'
  | 'eval:started'
  | 'eval:progress'
  | 'eval:complete'
  | 'store:changed'
  | 'freeplay:eval';

export interface AppState {
  game: GameData | null;
  currentMoveIndex: number; // -1 = start position
  mode: AppMode;
  freeplayBranchPoint: number;
  evaluations: MoveEvaluation[];
  isEvaluating: boolean;
  evalProgress: number; // 0-1
  boardFlipped: boolean;
  openingName: string | null;
  freeplayEval: EngineScore | null;
}
