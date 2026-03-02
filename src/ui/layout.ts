export function createLayout(): {
  backBtn: HTMLElement;
  gameInfo: HTMLElement;
  evalBar: HTMLElement;
  boardWrap: HTMLElement;
  navControls: HTMLElement;
  moveList: HTMLElement;
  trainerChat: HTMLElement;
  panelContent: HTMLElement;
} {
  const app = document.getElementById('app')!;
  app.innerHTML = '';

  const layout = el('div', 'app-layout');
  const mainCol = el('div', 'main-column');
  const sideCol = el('div', 'side-column');

  const backBtn = el('button', 'back-btn');
  backBtn.textContent = '\u2190 Back';

  const gameInfo = el('div', 'game-info');

  // Eval bar sits to the left of the board
  const boardRow = el('div', 'board-row');
  const evalBar = el('div', 'eval-bar');
  const boardWrap = el('div', 'board-wrap');
  boardRow.append(evalBar, boardWrap);

  const navControls = el('div', 'nav-controls');

  mainCol.append(backBtn, gameInfo, boardRow, navControls);

  const moveList = el('div', 'move-list');
  const trainerChat = el('div', 'trainer-chat');
  const panelContent = el('div', 'panel-content');

  sideCol.append(moveList, trainerChat, panelContent);
  layout.append(mainCol, sideCol);
  app.append(layout);

  return { backBtn, gameInfo, evalBar, boardWrap, navControls, moveList, trainerChat, panelContent };
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
