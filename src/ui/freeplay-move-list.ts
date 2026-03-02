import { bus, state } from '../state';
import type { MoveClassification } from '../types';

const ANNOTATION_SYMBOLS: Record<MoveClassification, string> = {
  book: '\u{1F4D6}',
  brilliant: '!!',
  great: '!',
  best: '\u2713',
  excellent: '\u2713',
  good: '\u2713',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

export function initFreeplayMoveList(container: HTMLElement): void {
  container.style.display = 'none';

  bus.on('freeplay:moved', () => render(container));
  bus.on('freeplay:eval-complete', () => render(container));
  bus.on('mode:changed', () => {
    if (state.mode !== 'freeplay') {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  });
}

function render(container: HTMLElement): void {
  container.innerHTML = '';
  const moves = state.freeplayMoves;
  if (moves.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  const label = document.createElement('span');
  label.className = 'freeplay-label';
  label.textContent = 'Freeplay';
  container.append(label);

  // Determine starting full-move number from branch point
  // branch point is a half-move index (-1 = before move 0)
  const firstHalfMove = state.freeplayBranchPoint + 1;

  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    const halfMoveIndex = firstHalfMove + i;
    const isWhite = halfMoveIndex % 2 === 0;

    // Start a new pair on white moves or the very first move (if black)
    if (isWhite || i === 0) {
      const pair = document.createElement('div');
      pair.className = 'move-pair';

      const num = document.createElement('span');
      num.className = 'move-number';
      const fullMoveNum = Math.floor(halfMoveIndex / 2) + 1;
      num.textContent = `${fullMoveNum}.`;
      pair.append(num);

      // If first freeplay move is black, add ellipsis
      if (!isWhite && i === 0) {
        const dots = document.createElement('span');
        dots.className = 'move';
        dots.textContent = '...';
        pair.append(dots);
      }

      pair.append(createMoveSpan(i, move.san));

      // If white move and next is black, add it to same pair
      if (isWhite && i + 1 < moves.length) {
        pair.append(createMoveSpan(i + 1, moves[i + 1].san));
        i++; // skip next since we consumed it
      }

      container.append(pair);
    }
  }

  scrollToCurrent(container);
}

function scrollToCurrent(container: HTMLElement): void {
  // Defer to next frame so the browser has laid out the container
  // (especially after toggling from display:none to display:flex)
  requestAnimationFrame(() => {
    const el = container.querySelector(`.move[data-freeplay-idx="${state.currentFreeplayMoveIndex}"]`) as HTMLElement | null;
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    if (eRect.left < cRect.left) {
      container.scrollLeft += eRect.left - cRect.left - 8;
    } else if (eRect.right > cRect.right) {
      container.scrollLeft += eRect.right - cRect.right + 8;
    }
  });
}

function createMoveSpan(freeplayIdx: number, san: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'move';
  span.dataset.freeplayIdx = String(freeplayIdx);

  const text = document.createElement('span');
  text.textContent = san;
  span.append(text);

  // Classification badge if evaluated
  const ev = state.freeplayEvaluations[freeplayIdx];
  if (ev) {
    span.classList.add(ev.classification);

    const badge = document.createElement('span');
    badge.className = `move-annotation ${ev.classification}`;
    badge.textContent = ANNOTATION_SYMBOLS[ev.classification];
    span.append(badge);
  }

  // Highlight current (always the latest)
  if (freeplayIdx === state.currentFreeplayMoveIndex) {
    span.classList.add('current');
  }

  return span;
}
