import type { AppState, AppEvent } from './types';

type Handler = (...args: unknown[]) => void;

class EventBus {
  private listeners = new Map<AppEvent, Set<Handler>>();

  on(event: AppEvent, fn: Handler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off(event: AppEvent, fn: Handler): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: AppEvent, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }
}

export const bus = new EventBus();

export const state: AppState = {
  game: null,
  currentMoveIndex: -1,
  mode: 'review',
  freeplayBranchPoint: -1,
  evaluations: [],
  isEvaluating: false,
  evalProgress: 0,
  boardFlipped: false,
  openingName: null,
};
