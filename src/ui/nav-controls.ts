import { bus, state } from '../state';

export interface NavCallbacks {
  onGoToStart: () => void;
  onBackward: () => void;
  onForward: () => void;
  onGoToEnd: () => void;
  onFreeplay: () => void;
  onResume: () => void;
}

export function initNavControls(container: HTMLElement, cb: NavCallbacks): void {
  render(container, cb);
  bus.on('game:loaded', () => render(container, cb));
  bus.on('mode:changed', () => render(container, cb));
  bus.on('eval:started', () => render(container, cb));
  bus.on('eval:complete', () => render(container, cb));
}

function render(container: HTMLElement, cb: NavCallbacks): void {
  container.innerHTML = '';

  const isFreeplay = state.mode === 'freeplay';
  const isEvaluating = state.isEvaluating;

  const btns: Array<[string, string, () => void, boolean?]> = [
    ['⏮', 'Start', cb.onGoToStart],
    ['◀', 'Back', cb.onBackward],
    ['▶', 'Forward', cb.onForward],
    ['⏭', 'End', cb.onGoToEnd],
  ];

  if (isFreeplay) {
    btns.push(['↩', 'Resume', cb.onResume, true]);
  } else {
    btns.push(['♟', 'Play', cb.onFreeplay]);
  }

  for (const [icon, title, handler, active] of btns) {
    const btn = document.createElement('button');
    btn.textContent = icon;
    btn.title = title;
    if (active) btn.classList.add('active');
    if (isEvaluating) btn.disabled = true;
    btn.addEventListener('click', handler);
    container.append(btn);
  }

}
