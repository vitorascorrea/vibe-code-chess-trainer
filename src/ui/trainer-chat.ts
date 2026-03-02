import type { TrainerMessage } from '../trainer';
import { getMessagesForMove } from '../trainer';
import { bus, state } from '../state';
import type { MoveClassification } from '../types';

const CLASSIFICATION_ICONS: Partial<Record<MoveClassification, string>> = {
  brilliant: '!!',
  great: '!',
  best: '*',
  excellent: '*',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

const TYPE_ICONS: Record<string, string> = {
  opening: '\u265e',   // chess knight
  summary: '\u2211',   // sigma
  pattern: '\u26a0',   // warning
  encouragement: '\u2714', // check
  move: '\u2022',       // bullet
};

let chatContainer: HTMLElement | null = null;
let messagesEl: HTMLElement | null = null;
let allMessages: TrainerMessage[] = [];
let headerEl: HTMLElement | null = null;

export function initTrainerChat(container: HTMLElement): void {
  chatContainer = container;
  container.innerHTML = '';

  // Header (collapsible)
  headerEl = document.createElement('div');
  headerEl.className = 'trainer-header';
  headerEl.innerHTML = '<span class="trainer-title">AI Trainer</span><span class="trainer-toggle">\u25BC</span>';
  headerEl.addEventListener('click', toggleChat);

  // Messages area
  messagesEl = document.createElement('div');
  messagesEl.className = 'trainer-messages';

  container.append(headerEl, messagesEl);

  // Show placeholder
  showPlaceholder();

  // Listen for events
  bus.on('position:changed', onPositionChanged);
  bus.on('eval:complete', onEvalComplete);
}

export function setTrainerMessages(messages: TrainerMessage[]): void {
  allMessages = messages;
  onPositionChanged();
}

export function destroyTrainerChat(): void {
  bus.off('position:changed', onPositionChanged);
  bus.off('eval:complete', onEvalComplete);
  allMessages = [];
  chatContainer = null;
  messagesEl = null;
  headerEl = null;
}

function toggleChat(): void {
  if (!messagesEl || !headerEl) return;
  const isCollapsed = messagesEl.classList.toggle('collapsed');
  const toggle = headerEl.querySelector('.trainer-toggle');
  if (toggle) toggle.textContent = isCollapsed ? '\u25B6' : '\u25BC';
}

function showPlaceholder(): void {
  if (!messagesEl) return;
  messagesEl.innerHTML = '';
  const placeholder = document.createElement('div');
  placeholder.className = 'chat-placeholder';
  placeholder.textContent = 'Evaluate a game to get personalized feedback.';
  messagesEl.append(placeholder);
}

function onPositionChanged(): void {
  if (!messagesEl || allMessages.length === 0) return;
  const messages = getMessagesForMove(allMessages, state.currentMoveIndex);
  renderMessages(messages);
}

function onEvalComplete(): void {
  // Messages are set externally via setTrainerMessages after generation
  // This just refreshes the view in case eval completes while user is looking
  if (allMessages.length > 0) {
    onPositionChanged();
  }
}

function renderMessages(messages: TrainerMessage[]): void {
  if (!messagesEl) return;
  messagesEl.innerHTML = '';

  if (messages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'chat-placeholder';
    empty.textContent = 'No specific feedback for this position.';
    messagesEl.append(empty);
    return;
  }

  for (const msg of messages) {
    messagesEl.append(createBubble(msg));
  }

  // Scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function createBubble(msg: TrainerMessage): HTMLElement {
  const bubble = document.createElement('div');
  bubble.className = `chat-message chat-${msg.type}`;
  if (msg.classification) {
    bubble.classList.add(`chat-cls-${msg.classification}`);
  }

  // Avatar/icon
  const avatar = document.createElement('span');
  avatar.className = 'chat-avatar';
  if (msg.classification && CLASSIFICATION_ICONS[msg.classification]) {
    avatar.textContent = CLASSIFICATION_ICONS[msg.classification]!;
    avatar.classList.add(msg.classification);
  } else {
    avatar.textContent = TYPE_ICONS[msg.type] || '\u2022';
  }

  // Text
  const text = document.createElement('span');
  text.className = 'chat-text';
  text.textContent = msg.text;

  bubble.append(avatar, text);
  return bubble;
}
