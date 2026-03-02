import { bus, state } from '../state';

let overlay: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let barFillEl: HTMLElement | null = null;
let initialized = false;

function ensureOverlay(): HTMLElement {
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'eval-overlay';
  overlay.style.display = 'none';

  const card = document.createElement('div');
  card.className = 'eval-overlay-card';

  statusEl = document.createElement('div');
  statusEl.className = 'eval-overlay-status';
  statusEl.textContent = 'Loading engine...';

  const barBg = document.createElement('div');
  barBg.className = 'eval-overlay-bar';

  barFillEl = document.createElement('div');
  barFillEl.className = 'eval-overlay-fill';

  barBg.append(barFillEl);
  card.append(statusEl, barBg);
  overlay.append(card);
  document.body.append(overlay);

  return overlay;
}

export function initEvalOverlay(): void {
  // Prevent duplicate listeners on re-entry
  if (initialized) return;
  initialized = true;

  const el = ensureOverlay();

  bus.on('eval:started', () => {
    el.style.display = '';
    statusEl!.textContent = 'Loading engine...';
    barFillEl!.style.width = '0%';
  });

  bus.on('eval:progress', () => {
    if (state.evalProgress === -1) {
      statusEl!.textContent = 'Loading engine...';
      barFillEl!.style.width = '0%';
    } else {
      const total = state.game?.moves.length ?? 0;
      const current = Math.round(state.evalProgress * total);
      statusEl!.textContent = `Evaluating move ${current}/${total}...`;
      barFillEl!.style.width = `${Math.round(state.evalProgress * 100)}%`;
    }
  });

  bus.on('eval:complete', () => {
    el.style.display = 'none';
  });
}
