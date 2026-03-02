import { bus, state } from '../state';

export interface NavCallbacks {
  onGoToStart: () => void;
  onBackward: () => void;
  onForward: () => void;
  onGoToEnd: () => void;
  onFreeplay: () => void;
  onResume: () => void;
  onEvaluatePosition: () => void;
  onUndo: () => void;
}

export function initNavControls(container: HTMLElement, cb: NavCallbacks): void {
  render(container, cb);
  bus.on('game:loaded', () => render(container, cb));
  bus.on('mode:changed', () => render(container, cb));
  bus.on('eval:started', () => render(container, cb));
  bus.on('eval:complete', () => render(container, cb));
  bus.on('freeplay:eval-complete', () => render(container, cb));
  bus.on('freeplay:moved', () => render(container, cb));
}

function render(container: HTMLElement, cb: NavCallbacks): void {
  container.innerHTML = '';

  const isFreeplay = state.mode === 'freeplay';
  const isEvaluating = state.isEvaluating;

  const btns: Array<[string, string, () => void, boolean?, boolean?]> = [
    ['\u23EE', 'Start', cb.onGoToStart, false, isFreeplay],
    ['\u25C0', 'Back', cb.onBackward, false, isFreeplay],
    ['\u25B6', 'Forward', cb.onForward, false, isFreeplay],
    ['\u23ED', 'End', cb.onGoToEnd, false, isFreeplay],
  ];

  if (isFreeplay) {
    btns.push(['\u21B6', 'Undo', cb.onUndo, false, state.freeplayMoves.length === 0]);
    if (!state.freeplayAutoEval) {
      btns.push(['\uD83D\uDD0D', 'Evaluate moves', cb.onEvaluatePosition, false, state.freeplayMoves.length === 0]);
    }
    btns.push(['\u21A9', 'Resume', cb.onResume, true]);
  } else {
    btns.push(['\u265F', 'Play', cb.onFreeplay]);
  }

  for (const [icon, title, handler, active, disabled] of btns) {
    const btn = document.createElement('button');
    btn.textContent = icon;
    btn.title = title;
    if (active) btn.classList.add('active');
    if (isEvaluating || disabled) btn.disabled = true;
    btn.addEventListener('click', handler);
    container.append(btn);
  }

  if (isFreeplay) {
    const label = document.createElement('label');
    label.className = 'auto-eval-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.freeplayAutoEval;
    checkbox.addEventListener('change', () => {
      state.freeplayAutoEval = checkbox.checked;
      render(container, cb);
    });

    const text = document.createElement('span');
    text.textContent = 'Auto-eval';

    label.append(checkbox, text);
    container.append(label);
  }
}
