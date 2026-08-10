import { STATUS_LABELS, STATUS_ORDER, type Game, type GameStatus } from './types';
import type { GameInput } from './store';

export interface DialogCallbacks {
  onSave: (input: GameInput, id: string | null) => void;
  onDelete: (id: string) => void;
}

const dialog = () => document.getElementById('game-dialog') as HTMLDialogElement;
const form = () => document.getElementById('game-form') as HTMLFormElement;

let currentId: string | null = null;
let callbacks: DialogCallbacks | null = null;

export function initDialog(cb: DialogCallbacks): void {
  callbacks = cb;
  const statusSelect = form().elements.namedItem('status') as HTMLSelectElement;
  for (const status of STATUS_ORDER) {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = STATUS_LABELS[status];
    statusSelect.append(option);
  }
  statusSelect.addEventListener('change', syncRatingVisibility);

  form().addEventListener('submit', (event) => {
    event.preventDefault();
    const titleInput = form().elements.namedItem('title') as HTMLInputElement;
    if (!titleInput.value.trim()) {
      titleInput.reportValidity();
      return;
    }
    callbacks?.onSave(readForm(), currentId);
    dialog().close();
  });

  (document.getElementById('cancel-btn') as HTMLButtonElement).addEventListener('click', () =>
    dialog().close(),
  );

  (document.getElementById('delete-btn') as HTMLButtonElement).addEventListener('click', () => {
    if (!currentId) return;
    const titleInput = form().elements.namedItem('title') as HTMLInputElement;
    if (confirm(`Delete "${titleInput.value.trim()}"? This cannot be undone.`)) {
      callbacks?.onDelete(currentId);
      dialog().close();
    }
  });
}

export function openGameDialog(
  game: Game | null,
  opts: { focusRating?: boolean; defaultStatus?: GameStatus } = {},
): void {
  currentId = game?.id ?? null;
  (document.getElementById('dialog-title') as HTMLElement).textContent = game
    ? 'Edit game'
    : 'Add game';
  (document.getElementById('delete-btn') as HTMLButtonElement).hidden = !game;

  const elements = form().elements;
  (elements.namedItem('title') as HTMLInputElement).value = game?.title ?? '';
  (elements.namedItem('status') as HTMLSelectElement).value =
    game?.status ?? opts.defaultStatus ?? 'backlog';
  (elements.namedItem('rating') as HTMLSelectElement).value = game?.rating
    ? String(game.rating)
    : '';
  (elements.namedItem('startedDate') as HTMLInputElement).value = game?.startedDate ?? '';
  (elements.namedItem('finishedDate') as HTMLInputElement).value = game?.finishedDate ?? '';
  (elements.namedItem('notes') as HTMLTextAreaElement).value = game?.notes ?? '';

  syncRatingVisibility();
  dialog().showModal();
  if (opts.focusRating) {
    (elements.namedItem('rating') as HTMLSelectElement).focus();
  } else {
    (elements.namedItem('title') as HTMLInputElement).focus();
  }
}

function syncRatingVisibility(): void {
  const status = (form().elements.namedItem('status') as HTMLSelectElement).value;
  (document.getElementById('rating-field') as HTMLElement).hidden = status !== 'beat';
}

function readForm(): GameInput {
  const elements = form().elements;
  const status = (elements.namedItem('status') as HTMLSelectElement).value as GameStatus;
  const ratingValue = (elements.namedItem('rating') as HTMLSelectElement).value;
  return {
    title: (elements.namedItem('title') as HTMLInputElement).value.trim(),
    status,
    rating: status === 'beat' && ratingValue ? Number(ratingValue) : null,
    startedDate: (elements.namedItem('startedDate') as HTMLInputElement).value || null,
    finishedDate: (elements.namedItem('finishedDate') as HTMLInputElement).value || null,
    notes: (elements.namedItem('notes') as HTMLTextAreaElement).value,
  };
}
