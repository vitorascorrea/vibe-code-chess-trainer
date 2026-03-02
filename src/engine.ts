import type { EngineEval, EngineScore } from './types';

export interface EngineProgressInfo {
  depth: number;
  score: EngineScore;
  pv: string[];
}

export interface EvaluateOptions {
  depth?: number;
}

export class Engine {
  private worker: Worker | null = null;
  private workerPath: string;
  private ready = false;

  constructor(workerPath = '/stockfish/stockfish-nnue-16-single.js') {
    this.workerPath = workerPath;
  }

  async init(): Promise<void> {
    this.worker = new Worker(this.workerPath);
    await this.uciCommand('uci', 'uciok');
    await this.uciCommand('isready', 'readyok');
    this.ready = true;
  }

  async evaluate(fen: string, options?: EvaluateOptions): Promise<EngineEval> {
    return this.evaluateWithProgress(fen, undefined, options);
  }

  async evaluateWithProgress(
    fen: string,
    onProgress?: (info: EngineProgressInfo) => void,
    options?: EvaluateOptions
  ): Promise<EngineEval> {
    if (!this.worker) throw new Error('Engine not initialized');

    const depth = options?.depth ?? 18;

    return new Promise((resolve) => {
      let bestEval: EngineEval = {
        score: { type: 'cp', value: 0 },
        bestMove: '',
        depth: 0,
        pv: [],
      };

      const handler = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : '';

        if (line.startsWith('info') && line.includes('score')) {
          const parsed = this.parseInfo(line);
          if (parsed && parsed.depth >= bestEval.depth) {
            bestEval = {
              score: parsed.score,
              bestMove: parsed.pv[0] || bestEval.bestMove,
              depth: parsed.depth,
              pv: parsed.pv,
            };
            onProgress?.(parsed);
          }
        }

        if (line.startsWith('bestmove')) {
          this.worker!.removeEventListener('message', handler);
          const bestMove = line.split(' ')[1] || bestEval.pv[0] || '';
          bestEval.bestMove = bestMove;

          // Normalize score to white's perspective.
          // Stockfish outputs from side-to-move's perspective.
          const isBlackToMove = fen.split(' ')[1] === 'b';
          if (isBlackToMove) {
            bestEval.score = {
              type: bestEval.score.type,
              value: -bestEval.score.value,
            };
          }

          resolve(bestEval);
        }
      };

      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage(`go depth ${depth}`);
    });
  }

  stop(): void {
    this.worker?.postMessage('stop');
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }

  get isReady(): boolean {
    return this.ready;
  }

  private uciCommand(cmd: string, waitFor: string): Promise<void> {
    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        if (typeof e.data === 'string' && e.data.includes(waitFor)) {
          this.worker!.removeEventListener('message', handler);
          resolve();
        }
      };
      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage(cmd);
    });
  }

  private parseInfo(line: string): EngineProgressInfo | null {
    const depthMatch = line.match(/\bdepth\s+(\d+)/);
    const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
    const pvMatch = line.match(/\bpv\s+(.+)/);

    if (!depthMatch || !scoreMatch) return null;

    return {
      depth: parseInt(depthMatch[1], 10),
      score: {
        type: scoreMatch[1] as 'cp' | 'mate',
        value: parseInt(scoreMatch[2], 10),
      },
      pv: pvMatch ? pvMatch[1].trim().split(/\s+/) : [],
    };
  }
}
