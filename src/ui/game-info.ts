import { bus, state } from '../state';

let flipCallback: (() => void) | null = null;

export function initGameInfo(container: HTMLElement, onFlip?: () => void): void {
  flipCallback = onFlip ?? null;
  render(container);
  bus.on('game:loaded', () => render(container));
}

function render(container: HTMLElement): void {
  container.innerHTML = '';
  const game = state.game;
  if (!game) {
    container.innerHTML = '<div class="meta">Paste a PGN to get started</div>';
    return;
  }

  const { headers, userColor } = game;
  const opening = state.openingName || '';

  const info = document.createElement('div');
  info.innerHTML = `
    <div class="players">${formatPlayer(headers.white, headers.whiteElo, userColor === 'w')} vs ${formatPlayer(headers.black, headers.blackElo, userColor === 'b')}</div>
    <div class="meta">Result: ${headers.result}${opening ? ' · ' + opening : ''}</div>
  `;

  // "Training as" toggle — sets which side the user is playing
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
  });

  blackBtn.addEventListener('click', () => {
    if (game.userColor === 'b') return;
    game.userColor = 'b';
    if (!state.boardFlipped && flipCallback) flipCallback();
    render(container);
  });

  toggle.append(label, whiteBtn, blackBtn);
  container.append(info, toggle);
}

function formatPlayer(name: string, elo: number, isUser: boolean): string {
  const cls = isUser ? ' class="user"' : '';
  return `<span${cls}>${name} (${elo})</span>`;
}
