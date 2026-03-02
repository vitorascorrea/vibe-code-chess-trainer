import { bus, state } from '../state';
import type { MoveClassification } from '../types';

const ANNOTATION_SYMBOLS: Record<MoveClassification, string> = {
  book: '📖',
  brilliant: '!!',
  great: '!',
  best: '✓',
  excellent: '✓',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

export function initMoveList(container: HTMLElement, onClickMove: (idx: number) => void): void {
  render(container, onClickMove);
  bus.on('game:loaded', () => render(container, onClickMove));
  bus.on('position:changed', () => updateCurrent(container));
  bus.on('eval:complete', () => render(container, onClickMove));
}

function render(container: HTMLElement, onClickMove: (idx: number) => void): void {
  container.innerHTML = '';
  const game = state.game;
  if (!game) return;

  for (let i = 0; i < game.moves.length; i += 2) {
    const pair = document.createElement('div');
    pair.className = 'move-pair';

    const num = document.createElement('span');
    num.className = 'move-number';
    num.textContent = `${Math.floor(i / 2) + 1}.`;
    pair.append(num);

    pair.append(createMoveSpan(i, game.moves[i].san, onClickMove));

    if (i + 1 < game.moves.length) {
      pair.append(createMoveSpan(i + 1, game.moves[i + 1].san, onClickMove));
    }

    container.append(pair);
  }

  updateCurrent(container);
}

function createMoveSpan(idx: number, san: string, onClick: (idx: number) => void): HTMLElement {
  const span = document.createElement('span');
  span.className = 'move';
  span.dataset.idx = String(idx);

  const text = document.createElement('span');
  text.textContent = san;
  span.append(text);

  // Add classification color + annotation badge if evaluated
  const ev = state.evaluations[idx];
  if (ev) {
    span.classList.add(ev.classification);

    const badge = document.createElement('span');
    badge.className = `move-annotation ${ev.classification}`;
    badge.textContent = ANNOTATION_SYMBOLS[ev.classification];
    span.append(badge);
  }

  span.addEventListener('click', () => onClick(idx));
  return span;
}

function updateCurrent(container: HTMLElement): void {
  container.querySelectorAll('.move.current').forEach((el) => el.classList.remove('current'));
  if (state.currentMoveIndex >= 0) {
    const el = container.querySelector(`.move[data-idx="${state.currentMoveIndex}"]`);
    if (el) {
      el.classList.add('current');
      // Horizontal scroll within the move list only — won't jump the page
      const parent = container;
      const elLeft = (el as HTMLElement).offsetLeft;
      const elWidth = (el as HTMLElement).offsetWidth;
      const scrollLeft = parent.scrollLeft;
      const parentWidth = parent.clientWidth;
      if (elLeft < scrollLeft) {
        parent.scrollLeft = elLeft - 8;
      } else if (elLeft + elWidth > scrollLeft + parentWidth) {
        parent.scrollLeft = elLeft + elWidth - parentWidth + 8;
      }
    }
  }
}
