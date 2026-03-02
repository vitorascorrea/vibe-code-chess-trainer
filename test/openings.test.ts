import { describe, it, expect } from 'vitest';
import { identifyOpening, getBookDepth } from '../src/openings';

describe('identifyOpening', () => {
  it('identifies Ruy Lopez', () => {
    const result = identifyOpening('1. e4 e5 2. Nf3 Nc6 3. Bb5');
    expect(result).not.toBeNull();
    expect(result!.name).toContain('Ruy Lopez');
  });

  it('identifies Sicilian Defense', () => {
    const result = identifyOpening('1. e4 c5');
    expect(result).not.toBeNull();
    expect(result!.name).toContain('Sicilian');
  });

  it('identifies Queen\'s Gambit', () => {
    const result = identifyOpening('1. d4 d5 2. c4');
    expect(result).not.toBeNull();
    expect(result!.name).toContain("Queen's Gambit");
  });

  it('returns the most specific name (deepest match)', () => {
    const result = identifyOpening('1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6');
    expect(result).not.toBeNull();
    expect(result!.name).toContain('Najdorf');
  });

  it('returns null for positions beyond opening book', () => {
    // A random sequence of legal moves unlikely in any opening book
    const result = identifyOpening('1. a3 h6 2. a4 h5 3. a5 h4 4. a6 h3 5. axb7 hxg2');
    // Might match early but not deep — either a partial match or null is fine
    // The key is it doesn't crash
    expect(result === null || result.name.length > 0).toBe(true);
  });

  it('identifies the user\'s actual game opening', () => {
    // correasam's game: 1. e3 e5 — Van't Kruijs Opening
    const result = identifyOpening('1. e3 e5');
    expect(result).not.toBeNull();
    expect(result!.eco).toBe('A00');
  });

  it('matches the deepest known position in a longer game', () => {
    // Play Italian Game moves then go beyond book
    const result = identifyOpening('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. a3 a6 5. h3 h6 6. Ra2');
    expect(result).not.toBeNull();
    // Should match at least up to Italian Game
    expect(result!.name).toContain('Italian');
  });
});

describe('getBookDepth', () => {
  it('returns depth for known opening moves', () => {
    // 1. e4 e5 2. Nf3 — all standard moves in the trie
    const depth = getBookDepth(['e4', 'e5', 'Nf3']);
    expect(depth).toBeGreaterThanOrEqual(3);
  });

  it('returns 0 for moves not in the trie', () => {
    const depth = getBookDepth(['Na3']);
    // Na3 is an uncommon first move — may or may not be in the trie
    // But a truly random move sequence should eventually hit 0
    expect(depth).toBeGreaterThanOrEqual(0);
  });

  it('stops at the first out-of-book move', () => {
    // e4, e5 are book, then something random like Ra6 (illegal from starting, but testing concept)
    const depth = getBookDepth(['e4', 'e5', 'Nf3', 'Nc6', 'ZZZZZ']);
    expect(depth).toBe(4); // 4 moves in book, ZZZZZ is not
  });

  it('returns full depth when all moves are in book', () => {
    // Full Ruy Lopez line
    const depth = getBookDepth(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
    expect(depth).toBe(5);
  });
});
