import 'cm-chessboard/assets/chessboard.css';
import 'cm-chessboard/assets/extensions/arrows/arrows.css';
import './style.css';

import { GameManager } from './game-manager';
import { EnginePool } from './engine-pool';
import { BoardController } from './board-controller';
import { EvalStore } from './eval-store';
import { evaluateGameParallel } from './classifier';
import { identifyOpening } from './openings';
import { bus, state } from './state';
import { createLayout } from './ui/layout';
import { initGameInfo } from './ui/game-info';
import { initEvalBar } from './ui/eval-bar';
import { initNavControls } from './ui/nav-controls';
import { initMoveList } from './ui/move-list';
import { initHistoryPanel } from './ui/history-panel';
import { initEvalOverlay } from './ui/eval-overlay';

const gm = new GameManager();
const pool = new EnginePool();
const store = new EvalStore();
let boardCtrl: BoardController | null = null;

// Keep track of UI elements
let ui: ReturnType<typeof createLayout> | null = null;

async function main() {
  showStartScreen();
}

// ── Start Screen ──

function showStartScreen(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'start-screen';

  const title = document.createElement('h1');
  title.className = 'start-title';
  title.textContent = 'Chess Evaluator';

  const subtitle = document.createElement('p');
  subtitle.className = 'start-subtitle';
  subtitle.textContent = 'Paste a PGN to analyze your game, or start a free play session.';

  const textarea = document.createElement('textarea');
  textarea.className = 'pgn-input';
  textarea.placeholder = 'Paste your chess.com PGN here...';
  textarea.rows = 6;

  const btnRow = document.createElement('div');
  btnRow.className = 'start-buttons';

  const loadBtn = document.createElement('button');
  loadBtn.className = 'btn';
  loadBtn.textContent = 'Load Game';
  loadBtn.addEventListener('click', () => {
    const pgn = textarea.value.trim();
    if (!pgn) return;
    enterApp(() => loadPgn(pgn));
  });

  const freeBtn = document.createElement('button');
  freeBtn.className = 'btn btn-secondary';
  freeBtn.textContent = 'Free Play';
  freeBtn.addEventListener('click', () => {
    enterApp(() => {
      gm.enterFreeplay();
      state.mode = 'freeplay';
      bus.emit('mode:changed');
      bus.emit('position:changed');
    });
  });

  // History section
  const historyItems = store.list();
  let historySection: HTMLElement | null = null;
  if (historyItems.length > 0) {
    historySection = document.createElement('div');
    historySection.className = 'start-history';
    const histTitle = document.createElement('h3');
    histTitle.textContent = `Past analyses (${historyItems.length})`;
    historySection.append(histTitle);

    const list = document.createElement('div');
    list.className = 'history-list';
    for (const item of historyItems.slice().reverse().slice(0, 5)) {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.innerHTML = `
        <div class="info">
          <div class="players">${item.headers.white} vs ${item.headers.black}</div>
          <div class="detail">${item.headers.result} · ${item.opening || 'Unknown'} · ${item.date}</div>
        </div>
      `;
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '🗑';
      delBtn.title = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Delete ${item.headers.white} vs ${item.headers.black}?`)) return;
        store.delete(item.id);
        showStartScreen(); // re-render start screen
      });

      row.append(delBtn);
      row.addEventListener('click', () => {
        enterApp(() => loadStored(item.id));
      });
      list.append(row);
    }
    historySection.append(list);
  }

  btnRow.append(loadBtn, freeBtn);
  screen.append(title, subtitle, textarea, btnRow);
  if (historySection) screen.append(historySection);
  app.append(screen);
}

// ── Transition to App ──

async function enterApp(afterMount: () => void): Promise<void> {
  const app = document.getElementById('app')!;
  app.innerHTML = '';

  ui = createLayout();
  boardCtrl = new BoardController(gm);

  // Back button → return to start screen
  ui.backBtn.addEventListener('click', () => {
    boardCtrl?.destroy();
    boardCtrl = null;
    state.game = null;
    state.evaluations = [];
    state.currentMoveIndex = -1;
    state.mode = 'review';
    state.isEvaluating = false;
    showStartScreen();
  });

  initGameInfo(ui.gameInfo, () => boardCtrl!.flip());
  initEvalBar(ui.evalBar);
  initEvalOverlay();
  initNavControls(ui.navControls, {
    onGoToStart: () => navigate(() => gm.goToStart()),
    onBackward: () => navigate(() => gm.backward()),
    onForward: () => navigate(() => gm.forward()),
    onGoToEnd: () => navigate(() => gm.goToEnd()),
    onFreeplay: () => {
      gm.enterFreeplay();
      state.mode = 'freeplay';
      state.freeplayBranchPoint = gm.freeplayBranchPoint;
      bus.emit('mode:changed');
    },
    onResume: () => {
      gm.resumePgn();
      state.mode = 'review';
      bus.emit('mode:changed');
      bus.emit('position:changed');
    },
  });

  initMoveList(ui.moveList, (idx) => navigate(() => gm.goToMove(idx)));
  initHistoryPanel(ui.panelContent, loadStored);

  await boardCtrl.mount(ui.boardWrap);
  setupKeyboard();

  afterMount();
}

// ── Keyboard ──

function setupKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        navigate(() => gm.backward());
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigate(() => gm.forward());
        break;
      case 'Home':
        e.preventDefault();
        navigate(() => gm.goToStart());
        break;
      case 'End':
        e.preventDefault();
        navigate(() => gm.goToEnd());
        break;
      case 'Escape':
        if (state.mode === 'freeplay') {
          gm.resumePgn();
          state.mode = 'review';
          bus.emit('mode:changed');
          bus.emit('position:changed');
        }
        break;
      case 'f':
      case 'F':
        boardCtrl?.flip();
        break;
    }
  });
}

// ── Navigation ──

function navigate(action: () => void): void {
  action();
  state.currentMoveIndex = gm.currentMoveIndex;
  bus.emit('position:changed');
}

// ── PGN Loading ──

function loadGameData(pgn: string): void {
  const game = gm.loadPgn(pgn);
  state.game = game;
  state.currentMoveIndex = -1;
  state.mode = 'review';
  state.evaluations = [];

  const movesSan = game.moves.map((m) => m.san);
  const opening = identifyOpening(movesSan);
  state.openingName = opening?.name ?? null;

  bus.emit('game:loaded');
  bus.emit('position:changed');
}

function loadPgn(pgn: string): void {
  try {
    loadGameData(pgn);
    runEvaluation();
  } catch (err) {
    console.error('Failed to load PGN:', err);
    alert('Invalid PGN. Please check the format and try again.');
  }
}

function loadStored(id: string): void {
  const stored = store.get(id);
  if (!stored) return;
  try {
    loadGameData(stored.pgn);
    state.evaluations = stored.evaluations;
    bus.emit('eval:complete');
  } catch (err) {
    console.error('Failed to load stored game:', err);
  }
}

// ── Evaluation ──

async function runEvaluation(): Promise<void> {
  if (!state.game || state.isEvaluating) return;

  state.isEvaluating = true;
  state.evalProgress = 0;
  bus.emit('eval:started');

  try {
    if (!pool.isReady) {
      state.evalProgress = -1; // signal "loading engine"
      bus.emit('eval:progress');
      await pool.init();
    }

    state.evalProgress = 0;
    bus.emit('eval:progress');

    const evals = await evaluateGameParallel(
      pool,
      state.game.moves,
      { depth: 20 },
      (current, total) => {
        state.evalProgress = current / total;
        bus.emit('eval:progress');
      }
    );

    state.evaluations = evals;
    state.isEvaluating = false;
    bus.emit('eval:complete');

    // Save to history
    const id = `${state.game.headers.white}-${state.game.headers.black}-${state.game.headers.date}-${Date.now()}`;
    store.save({
      id,
      date: state.game.headers.date,
      headers: state.game.headers,
      opening: state.openingName,
      pgn: rebuildPgn(),
      evaluations: evals,
      createdAt: Date.now(),
    });
    bus.emit('store:changed');
  } catch (err) {
    console.error('Evaluation failed:', err);
    state.isEvaluating = false;
    bus.emit('eval:complete');
  }
}

function rebuildPgn(): string {
  if (!state.game) return '';
  const headers = state.game.headers;
  const headerLines = [
    `[White "${headers.white}"]`,
    `[Black "${headers.black}"]`,
    `[Result "${headers.result}"]`,
    `[WhiteElo "${headers.whiteElo}"]`,
    `[BlackElo "${headers.blackElo}"]`,
    `[Date "${headers.date}"]`,
  ].join('\n');

  const moves = state.game.moves.map((m, i) => {
    const prefix = i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : '';
    return prefix + m.san;
  }).join(' ');

  return `${headerLines}\n\n${moves} ${headers.result}`;
}

main();
