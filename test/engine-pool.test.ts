import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnginePool } from '../src/engine-pool';

// Mock Worker that simulates Stockfish UCI protocol
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  private handlers: Array<(msg: string) => void> = [];

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
    } else if (cmd.startsWith('go')) {
      this.reply('info depth 10 score cp 15 pv e2e4 e7e5');
      this.reply('info depth 18 score cp 20 pv e2e4 e7e5 g1f3');
      this.reply('bestmove e2e4 ponder e7e5');
    } else if (cmd === 'stop') {
      this.reply('bestmove e2e4 ponder e7e5');
    }
  }
}

describe('EnginePool', () => {
  let pool: EnginePool;

  beforeEach(() => {
    vi.stubGlobal('Worker', vi.fn(() => new MockWorker()));
  });

  afterEach(() => {
    pool?.destroy();
    vi.unstubAllGlobals();
  });

  it('initializes all workers and becomes ready', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 3);
    expect(pool.isReady).toBe(false);
    await pool.init();
    expect(pool.isReady).toBe(true);
  });

  it('respects explicit pool size', () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    expect(pool.size).toBe(2);
  });

  it('caps pool size at 4', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 16 });
    pool = new EnginePool('/stockfish/stockfish.js');
    expect(pool.size).toBe(4);
  });

  it('uses at least 1 worker', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 0 });
    pool = new EnginePool('/stockfish/stockfish.js');
    expect(pool.size).toBe(1);
  });

  it('evaluates multiple FENs in parallel', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    await pool.init();

    const fens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      '4k3/8/8/8/8/8/8/4K3 w - - 0 40',
    ];

    const results = await pool.evaluateAll(fens);

    expect(results.size).toBe(3);
    for (const fen of fens) {
      const result = results.get(fen);
      expect(result).toBeDefined();
      expect(result!.bestMove).toBe('e2e4');
    }
  });

  it('returns empty map for empty input', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    await pool.init();

    const results = await pool.evaluateAll([]);
    expect(results.size).toBe(0);
  });

  it('reports progress as positions complete', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    await pool.init();

    const fens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      '4k3/8/8/8/8/8/8/4K3 w - - 0 40',
    ];

    const progressCalls: Array<[number, number]> = [];
    await pool.evaluateAll(fens, undefined, (completed, total) => {
      progressCalls.push([completed, total]);
    });

    expect(progressCalls.length).toBe(2);
    // Every call should have total === 2
    for (const [, total] of progressCalls) {
      expect(total).toBe(2);
    }
    // Final call should have completed === 2
    expect(progressCalls[progressCalls.length - 1][0]).toBe(2);
  });

  it('throws if evaluateAll called before init', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    await expect(pool.evaluateAll(['some fen'])).rejects.toThrow('Pool not initialized');
  });

  it('destroy cleans up all workers', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 2);
    await pool.init();
    expect(pool.isReady).toBe(true);

    pool.destroy();
    expect(pool.isReady).toBe(false);
  });

  it('normalizes black-to-move scores correctly through Engine', async () => {
    pool = new EnginePool('/stockfish/stockfish.js', 1);
    await pool.init();

    const results = await pool.evaluateAll([
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    ]);

    const result = results.get('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    // Mock returns cp 20 from STM (black) perspective, Engine negates to -20
    expect(result!.score.value).toBe(-20);
  });
});
