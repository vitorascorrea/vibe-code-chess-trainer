import { bus, state } from '../state';
import { identifyOpening } from '../openings';

let flipCallback: (() => void) | null = null;
let openingEl: HTMLElement | null = null;

export function initGameInfo(container: HTMLElement, onFlip?: () => void): void {
  flipCallback = onFlip ?? null;
  render(container);
  bus.on('game:loaded', () => render(container));
  bus.on('position:changed', () => updateOpening());
  bus.on('freeplay:moved', () => updateOpening());
}

function render(container: HTMLElement): void {
  container.innerHTML = '';
  openingEl = null;
  const game = state.game;
  if (!game) {
    container.innerHTML = '<div class="meta">Paste a PGN to get started</div>';
    return;
  }

  const { headers, userColor } = game;

  const info = document.createElement('div');
  info.innerHTML = `
    <div class="players">${formatPlayer(headers.white, headers.whiteElo, userColor === 'w')} vs ${formatPlayer(headers.black, headers.blackElo, userColor === 'b')}</div>
    <div class="meta">Result: ${headers.result}</div>
  `;

  openingEl = document.createElement('div');
  openingEl.className = 'opening-name';
  info.append(openingEl);

  // "Training as" toggle
  const toggle = document.createElement('div');
  toggle.className = 'color-toggle';

  const label = document.createElement('span');
  label.textContent = 'Training as:';
  label.style.fontSize = '13px';
  label.style.color = 'var(--text-muted)';

  const whiteBtn = document.createElement('button');
  whiteBtn.textContent = 'White';
  if (userColor === 'w') whiteBtn.classList.add('active');

  const blackBtn = document.createElement('button');
  blackBtn.textContent = 'Black';
  if (userColor === 'b') blackBtn.classList.add('active');

  whiteBtn.addEventListener('click', () => {
    if (game.userColor === 'w') return;
    game.userColor = 'w';
    if (state.boardFlipped && flipCallback) flipCallback();
    render(container);
    updateOpening();
  });

  blackBtn.addEventListener('click', () => {
    if (game.userColor === 'b') return;
    game.userColor = 'b';
    if (!state.boardFlipped && flipCallback) flipCallback();
    render(container);
    updateOpening();
  });

  toggle.append(label, whiteBtn, blackBtn);
  container.append(info, toggle);
  updateOpening();
}

function updateOpening(): void {
  if (!openingEl) return;

  // Collect moves up to current position
  let moves: string[];
  if (state.mode === 'freeplay') {
    // Game moves up to branch point + freeplay moves
    const gameMoves = state.game
      ? state.game.moves.slice(0, state.freeplayBranchPoint + 1).map(m => m.san)
      : [];
    const fpMoves = state.freeplayMoves.map(m => m.san);
    moves = [...gameMoves, ...fpMoves];
  } else {
    if (!state.game || state.currentMoveIndex < 0) {
      openingEl.textContent = '';
      return;
    }
    moves = state.game.moves.slice(0, state.currentMoveIndex + 1).map(m => m.san);
  }

  const opening = identifyOpening(moves);
  openingEl.textContent = opening ? opening.name : '';
}

function formatPlayer(name: string, elo: number, isUser: boolean): string {
  const cls = isUser ? ' class="user"' : '';
  return `<span${cls}>${name} (${elo})</span>`;
}
