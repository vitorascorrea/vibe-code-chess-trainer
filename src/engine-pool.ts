import { Engine } from './engine';
import type { EvaluateOptions } from './engine';
import type { EngineEval } from './types';

export class EnginePool {
  private engines: Engine[] = [];
  private workerPath: string;
  private poolSize: number;
  private ready = false;

  constructor(
    workerPath = `${import.meta.env.BASE_URL}stockfish/stockfish-nnue-16-single.js`,
    poolSize?: number
  ) {
    this.workerPath = workerPath;
    this.poolSize = poolSize ?? Math.min(Math.max(navigator?.hardwareConcurrency ?? 1, 1), 4);
  }

  async init(): Promise<void> {
    this.engines = Array.from({ length: this.poolSize }, () => new Engine(this.workerPath));
    await Promise.all(this.engines.map((e) => e.init()));
    this.ready = true;
  }

  /**
   * Evaluate multiple FEN positions in parallel using a task queue.
   * Each engine picks up the next pending task as soon as it finishes.
   */
  async evaluateAll(
    fens: string[],
    options?: EvaluateOptions,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, EngineEval>> {
    if (!this.ready) throw new Error('Pool not initialized');

    const results = new Map<string, EngineEval>();
    if (fens.length === 0) return results;

    let completed = 0;
    let nextIndex = 0;

    const processNext = async (engine: Engine): Promise<void> => {
      while (nextIndex < fens.length) {
        const idx = nextIndex++;
        const fen = fens[idx];
        const result = await engine.evaluate(fen, options);
        results.set(fen, result);
        completed++;
        onProgress?.(completed, fens.length);
      }
    };

    await Promise.all(this.engines.map((engine) => processNext(engine)));

    return results;
  }

  destroy(): void {
    for (const engine of this.engines) {
      engine.destroy();
    }
    this.engines = [];
    this.ready = false;
  }

  get isReady(): boolean {
    return this.ready;
  }

  get size(): number {
    return this.poolSize;
  }
}
