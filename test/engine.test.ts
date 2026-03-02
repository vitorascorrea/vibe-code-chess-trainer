import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Engine } from '../src/engine';

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

describe('Engine', () => {
  let engine: Engine;

  beforeEach(() => {
    vi.stubGlobal('Worker', vi.fn(() => new MockWorker()));
    engine = new Engine('/stockfish/stockfish.js');
  });

  afterEach(() => {
    engine.destroy();
    vi.unstubAllGlobals();
  });

  it('initializes and becomes ready', async () => {
    await engine.init();
    // No error = success
  });

  it('evaluates a position returning score and best move', async () => {
    await engine.init();
    const result = await engine.evaluate('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

    expect(result.score.type).toBe('cp');
    expect(result.score.value).toBe(20);
    expect(result.bestMove).toBe('e2e4');
    expect(result.depth).toBe(18);
  });

  it('multiple evaluations in sequence work correctly', async () => {
    await engine.init();
    const r1 = await engine.evaluate('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const r2 = await engine.evaluate('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');

    expect(r1.bestMove).toBe('e2e4');
    expect(r2.bestMove).toBe('e2e4'); // mock returns same, but point is no stale state
  });

  it('normalizes score to white perspective — positive for white-to-move', async () => {
    await engine.init();
    const result = await engine.evaluate('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    // Mock returns cp 20 from STM (white) perspective — no negation needed
    expect(result.score.value).toBe(20);
  });

  it('normalizes score to white perspective — negates for black-to-move', async () => {
    await engine.init();
    const result = await engine.evaluate('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    // Mock returns cp 20 from STM (black) perspective — engine should negate to -20
    expect(result.score.value).toBe(-20);
  });

  it('fires progress callbacks with evaluateWithProgress', async () => {
    await engine.init();
    const depths: number[] = [];
    await engine.evaluateWithProgress(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      (info) => depths.push(info.depth)
    );

    expect(depths).toContain(10);
    expect(depths).toContain(18);
  });
});
