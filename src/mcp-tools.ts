/**
 * WebMCP tool exposure for browser-based AI agents.
 *
 * Registers tools via the navigator.modelContext API (W3C WebMCP spec).
 * Falls back to window.__mcp_tools__ for agents that don't support the native API yet.
 *
 * All tools are read-only queries against app state, except navigate_to_move
 * which triggers a position change.
 */

import { state, bus } from './state';
import type { MoveEvaluation, MoveClassification } from './types';

// ── Type declarations for WebMCP API (not yet in lib.dom.d.ts) ──

interface McpToolAnnotations {
  readOnlyHint?: boolean;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
  annotations?: McpToolAnnotations;
}

interface McpProvideContextOptions {
  tools: McpTool[];
}

interface ModelContext {
  provideContext(options?: McpProvideContextOptions): void;
  clearContext(): void;
  registerTool(tool: McpTool): void;
  unregisterTool(name: string): void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
  interface Window {
    __mcp_tools__?: Record<string, McpTool>;
  }
}

// ── Navigation callback (set by main.ts) ──

let navigateCallback: ((moveIndex: number) => void) | null = null;

export function setNavigateCallback(cb: (moveIndex: number) => void): void {
  navigateCallback = cb;
}

// ── Tool definitions ──

function buildTools(): McpTool[] {
  return [
    {
      name: 'get_current_position',
      description: 'Returns the current board position as FEN, move index, and whose turn it is.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const game = state.game;
        if (!game) return { error: 'No game loaded' };

        const moveIndex = state.currentMoveIndex;
        const fen = moveIndex >= 0
          ? game.moves[moveIndex].fenAfter
          : game.startFen;
        const turn = fen.split(' ')[1] === 'w' ? 'white' : 'black';

        return { fen, moveIndex, turn, totalMoves: game.moves.length };
      },
    },

    {
      name: 'get_move_evaluation',
      description: 'Returns the full evaluation for a specific move index, including classification, centipawn loss, and engine suggestion.',
      inputSchema: {
        type: 'object',
        properties: {
          moveIndex: { type: 'number', description: 'Zero-based half-move index' },
        },
        required: ['moveIndex'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const idx = input.moveIndex as number;
        const ev = state.evaluations.find((e) => e.moveIndex === idx);
        if (!ev) return { error: `No evaluation for move index ${idx}` };
        return formatEvaluation(ev);
      },
    },

    {
      name: 'get_game_summary',
      description: 'Returns game headers, opening name, move count, and classification distribution across all moves.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const game = state.game;
        if (!game) return { error: 'No game loaded' };

        const distribution: Partial<Record<MoveClassification, number>> = {};
        for (const ev of state.evaluations) {
          distribution[ev.classification] = (distribution[ev.classification] || 0) + 1;
        }

        return {
          headers: game.headers,
          opening: state.openingName,
          totalMoves: game.moves.length,
          userColor: game.userColor,
          classificationDistribution: distribution,
          evaluated: state.evaluations.length > 0,
        };
      },
    },

    {
      name: 'get_eval_at_move',
      description: 'Returns the engine evaluation before and after a specific move, with centipawn scores and best lines.',
      inputSchema: {
        type: 'object',
        properties: {
          moveIndex: { type: 'number', description: 'Zero-based half-move index' },
        },
        required: ['moveIndex'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const idx = input.moveIndex as number;
        const ev = state.evaluations.find((e) => e.moveIndex === idx);
        if (!ev) return { error: `No evaluation for move index ${idx}` };
        return {
          moveIndex: idx,
          san: ev.san,
          evalBefore: ev.evalBefore,
          evalAfter: ev.evalAfter,
        };
      },
    },

    {
      name: 'get_principal_variation',
      description: "Returns the engine's suggested best line (principal variation) at a given move.",
      inputSchema: {
        type: 'object',
        properties: {
          moveIndex: { type: 'number', description: 'Zero-based half-move index' },
        },
        required: ['moveIndex'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const idx = input.moveIndex as number;
        const ev = state.evaluations.find((e) => e.moveIndex === idx);
        if (!ev || !ev.evalBefore) return { error: `No PV data for move index ${idx}` };
        return {
          moveIndex: idx,
          pv: ev.evalBefore.pv,
          bestMove: ev.evalBefore.bestMove,
          depth: ev.evalBefore.depth,
        };
      },
    },

    {
      name: 'navigate_to_move',
      description: 'Navigates the board to a specific move index. Use -1 for the starting position.',
      inputSchema: {
        type: 'object',
        properties: {
          moveIndex: { type: 'number', description: 'Zero-based half-move index, or -1 for start' },
        },
        required: ['moveIndex'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        const idx = input.moveIndex as number;
        if (!state.game) return { error: 'No game loaded' };
        if (idx < -1 || idx >= state.game.moves.length) {
          return { error: `Move index ${idx} out of range (-1 to ${state.game.moves.length - 1})` };
        }
        if (navigateCallback) {
          navigateCallback(idx);
        } else {
          state.currentMoveIndex = idx;
          bus.emit('position:changed');
        }
        return { success: true, moveIndex: idx };
      },
    },

    {
      name: 'get_opening_info',
      description: 'Returns the identified opening name for the current game.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        return {
          opening: state.openingName,
          hasGame: !!state.game,
        };
      },
    },
  ];
}

function formatEvaluation(ev: MoveEvaluation): Record<string, unknown> {
  return {
    moveIndex: ev.moveIndex,
    san: ev.san,
    color: ev.color === 'w' ? 'white' : 'black',
    classification: ev.classification,
    cpLoss: ev.cpLoss,
    engineSuggestion: ev.engineSuggestionSan ?? null,
    evalBefore: ev.evalBefore ? {
      score: ev.evalBefore.score,
      bestMove: ev.evalBefore.bestMove,
      depth: ev.evalBefore.depth,
    } : null,
    evalAfter: ev.evalAfter ? {
      score: ev.evalAfter.score,
      depth: ev.evalAfter.depth,
    } : null,
  };
}

// ── Registration ──

export function registerMcpTools(): void {
  const tools = buildTools();

  // Try native WebMCP API first
  if (navigator.modelContext) {
    try {
      navigator.modelContext.provideContext({ tools });
      console.log('[WebMCP] Registered', tools.length, 'tools via navigator.modelContext');
      return;
    } catch (err) {
      console.warn('[WebMCP] navigator.modelContext.provideContext failed, falling back:', err);
    }
  }

  // Fallback: expose on window for agents that poll for tools
  const toolMap: Record<string, McpTool> = {};
  for (const tool of tools) {
    toolMap[tool.name] = tool;
  }
  window.__mcp_tools__ = toolMap;
  console.log('[WebMCP] Registered', tools.length, 'tools via window.__mcp_tools__');
}

export function unregisterMcpTools(): void {
  if (navigator.modelContext) {
    try {
      navigator.modelContext.clearContext();
    } catch {
      // ignore
    }
  }
  delete window.__mcp_tools__;
}
