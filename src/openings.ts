import openingsData from './data/openings.json';
import type { Opening } from './types';

interface OpeningEntry {
  eco: string;
  name: string;
  pgn: string;
}

// Build a trie keyed by move sequences for fast prefix matching.
// Each node stores the deepest opening that ends at that move sequence.
interface TrieNode {
  opening: Opening | null;
  children: Map<string, TrieNode>;
}

function buildTrie(entries: OpeningEntry[]): TrieNode {
  const root: TrieNode = { opening: null, children: new Map() };

  for (const entry of entries) {
    // Normalize PGN to a list of SAN moves (strip move numbers)
    const moves = pgnToMoves(entry.pgn);
    let node = root;

    for (const move of moves) {
      if (!node.children.has(move)) {
        node.children.set(move, { opening: null, children: new Map() });
      }
      node = node.children.get(move)!;
    }

    // Deeper (more specific) openings overwrite shallower ones at the same node.
    // If two openings end at the same move, keep the longer-named (more specific) one.
    if (!node.opening || entry.name.length > node.opening.name.length) {
      node.opening = { eco: entry.eco, name: entry.name, fen: '' };
    }
  }

  return root;
}

function pgnToMoves(pgn: string): string[] {
  return pgn
    .replace(/\d+\.\s*/g, '') // strip move numbers
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const trie = buildTrie(openingsData as OpeningEntry[]);

/**
 * Identify the most specific opening for a PGN or move list.
 * Walks the trie as far as possible, returning the deepest match.
 */
export function identifyOpening(pgn: string): Opening | null;
export function identifyOpening(moves: string[]): Opening | null;
export function identifyOpening(input: string | string[]): Opening | null {
  const moves = typeof input === 'string' ? pgnToMoves(input) : input;

  let node = trie;
  let bestMatch: Opening | null = node.opening;

  for (const move of moves) {
    const child = node.children.get(move);
    if (!child) break;
    node = child;
    if (node.opening) bestMatch = node.opening;
  }

  return bestMatch;
}

/**
 * Returns the number of half-moves (from the start) that are still "in book".
 * Walks the trie — as long as each move exists as a child, it's a book move.
 * Once a move falls out of the trie, that's where book ends.
 */
export function getBookDepth(moves: string[]): number {
  let node = trie;
  let depth = 0;

  for (const move of moves) {
    const child = node.children.get(move);
    if (!child) break;
    node = child;
    depth++;
  }

  return depth;
}
