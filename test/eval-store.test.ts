import { describe, it, expect, beforeEach } from 'vitest';
import { EvalStore } from '../src/eval-store';
import type { StoredEvaluation, GameHeaders } from '../src/types';

function makeDummyEval(id: string, white = 'correasam', black = 'opponent'): StoredEvaluation {
  return {
    id,
    date: '2026-02-28',
    headers: {
      white,
      black,
      whiteElo: 461,
      blackElo: 408,
      result: '0-1',
      date: '2026-02-28',
      event: 'Live Chess',
      timeControl: '600',
      termination: 'checkmate',
    },
    opening: 'Scandinavian Defense',
    pgn: '1. e4 d5',
    evaluations: [],
    createdAt: Date.now(),
  };
}

describe('EvalStore', () => {
  let store: EvalStore;

  beforeEach(() => {
    localStorage.clear();
    store = new EvalStore();
  });

  it('starts with empty list', () => {
    expect(store.list()).toEqual([]);
  });

  it('saves and retrieves an evaluation', () => {
    const ev = makeDummyEval('game-1');
    store.save(ev);

    const list = store.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('game-1');
  });

  it('gets a specific evaluation by id', () => {
    store.save(makeDummyEval('game-1'));
    store.save(makeDummyEval('game-2'));

    const result = store.get('game-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('game-1');
  });

  it('returns null for non-existent id', () => {
    expect(store.get('nope')).toBeNull();
  });

  it('deletes an evaluation', () => {
    store.save(makeDummyEval('game-1'));
    store.save(makeDummyEval('game-2'));
    store.delete('game-1');

    expect(store.list().length).toBe(1);
    expect(store.get('game-1')).toBeNull();
  });

  it('clears all evaluations', () => {
    store.save(makeDummyEval('game-1'));
    store.save(makeDummyEval('game-2'));
    store.clear();

    expect(store.list()).toEqual([]);
  });

  it('persists across instances (localStorage)', () => {
    store.save(makeDummyEval('game-1'));

    const store2 = new EvalStore();
    expect(store2.list().length).toBe(1);
    expect(store2.get('game-1')!.id).toBe('game-1');
  });

  it('stores player names, date, opening, result', () => {
    store.save(makeDummyEval('game-1', 'Alice', 'Bob'));

    const result = store.get('game-1')!;
    expect(result.headers.white).toBe('Alice');
    expect(result.headers.black).toBe('Bob');
    expect(result.opening).toBe('Scandinavian Defense');
    expect(result.headers.result).toBe('0-1');
  });
});
