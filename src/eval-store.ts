import type { StoredEvaluation } from './types';

const STORAGE_KEY = 'chess-evaluator-history';

export class EvalStore {
  private load(): StoredEvaluation[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private persist(data: StoredEvaluation[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  list(): StoredEvaluation[] {
    return this.load();
  }

  get(id: string): StoredEvaluation | null {
    return this.load().find((e) => e.id === id) ?? null;
  }

  save(evaluation: StoredEvaluation): void {
    const data = this.load();
    const idx = data.findIndex((e) => e.id === evaluation.id);
    if (idx >= 0) {
      data[idx] = evaluation;
    } else {
      data.push(evaluation);
    }
    this.persist(data);
  }

  delete(id: string): void {
    const data = this.load().filter((e) => e.id !== id);
    this.persist(data);
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
