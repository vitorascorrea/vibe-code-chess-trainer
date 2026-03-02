import { bus, state } from '../state';
import type { EngineScore, MoveClassification } from '../types';

export function initEvalBar(container: HTMLElement): void {
  container.innerHTML = '';

  // White portion fills from bottom
  const whiteFill = document.createElement('div');
  whiteFill.className = 'eval-bar-white';
  whiteFill.style.height = '50%';

  const badgeEl = document.createElement('span');
  badgeEl.className = 'eval-bar-badge';
  badgeEl.style.display = 'none';

  container.append(whiteFill, badgeEl);

  function update(): void {
    if (state.isEvaluating) {
      whiteFill.style.height = '50%';
      badgeEl.style.display = 'none';
      return;
    }

    // In freeplay, show freeplay evaluation if available
    if (state.mode === 'freeplay') {
      const fpIdx = state.currentFreeplayMoveIndex;
      const fpEv = fpIdx >= 0 ? state.freeplayEvaluations[fpIdx] : null;

      if (fpEv && fpEv.evalAfter) {
        whiteFill.style.height = `${scoreToPct(fpEv.evalAfter.score)}%`;
        badgeEl.className = `eval-bar-badge ${fpEv.classification}`;
        badgeEl.textContent = classificationSymbol(fpEv.classification);
        badgeEl.style.display = '';
      } else if (state.freeplayEval) {
        whiteFill.style.height = `${scoreToPct(state.freeplayEval)}%`;
        badgeEl.style.display = 'none';
      } else {
        whiteFill.style.height = '50%';
        badgeEl.style.display = 'none';
      }
      return;
    }

    const moveIdx = state.currentMoveIndex;
    const ev = state.evaluations[moveIdx];

    if (!ev || ev.classification === 'book') {
      whiteFill.style.height = '50%';
      badgeEl.style.display = 'none';
      return;
    }

    const score = ev.evalAfter?.score;
    whiteFill.style.height = `${score ? scoreToPct(score) : 50}%`;

    // Badge
    badgeEl.className = `eval-bar-badge ${ev.classification}`;
    badgeEl.textContent = classificationSymbol(ev.classification);
    badgeEl.style.display = '';
  }

  bus.on('position:changed', update);
  bus.on('eval:complete', update);
  bus.on('eval:started', update);
  bus.on('eval:progress', update);
  bus.on('freeplay:eval', update);
  bus.on('freeplay:eval-complete', update);
  bus.on('mode:changed', update);
}

function classificationSymbol(cls: MoveClassification): string {
  switch (cls) {
    case 'brilliant': return '!!';
    case 'great': return '!';
    case 'best': return '\u2713';
    case 'excellent': return '\u2713';
    case 'good': return '\u2713';
    case 'inaccuracy': return '?!';
    case 'mistake': return '?';
    case 'blunder': return '??';
    default: return '';
  }
}

function scoreToPct(score: EngineScore): number {
  let cp: number;
  if (score.type === 'mate') {
    cp = score.value > 0 ? 1000 : -1000;
  } else {
    cp = score.value;
  }
  // White fills from bottom: 50% = equal, 100% = white winning, 0% = black winning
  const pct = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  return Math.max(2, Math.min(98, pct));
}
