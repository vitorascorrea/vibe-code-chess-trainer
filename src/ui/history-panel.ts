import { bus } from '../state';
import { EvalStore } from '../eval-store';

const store = new EvalStore();

export function initHistoryPanel(
  contentContainer: HTMLElement,
  onLoadStored: (id: string) => void
): void {
  renderHistory(contentContainer, onLoadStored);
  bus.on('store:changed', () => renderHistory(contentContainer, onLoadStored));
}

function renderHistory(
  container: HTMLElement,
  onLoadStored: (id: string) => void
): void {
  container.innerHTML = '';

  const items = store.list();
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-muted);font-size:13px;padding:8px 0;';
    empty.textContent = 'No evaluations saved yet.';
    container.append(empty);
    return;
  }

  const title = document.createElement('div');
  title.style.cssText = 'color:var(--text-muted);font-size:13px;margin-bottom:6px;';
  title.textContent = `Past analyses (${items.length})`;
  container.append(title);

  const list = document.createElement('div');
  list.className = 'history-list';

  for (const item of items.slice().reverse()) {
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
      bus.emit('store:changed');
    });

    row.append(delBtn);
    row.addEventListener('click', () => onLoadStored(item.id));
    list.append(row);
  }

  container.append(list);
}
