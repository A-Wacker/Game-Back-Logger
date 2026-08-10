import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { STATUS_LABELS, STATUS_ORDER, isGameStatus, type GameStatus } from './types';
import * as store from './store';
import { groupGames, isFiltering, type FilterState } from './filters';
import { renderSections } from './render';
import { initDialog, openGameDialog } from './dialog';
import { downloadBackup, parseBackupFile } from './backup';

registerSW({ immediate: true });
if (navigator.storage?.persist) void navigator.storage.persist();

const UI_PREFS_KEY = 'game-back-logger:ui';

const filter: FilterState = { query: '', status: 'all' };
const collapsed = loadCollapsed();

const sectionsEl = document.getElementById('sections') as HTMLElement;
const searchEl = document.getElementById('search') as HTMLInputElement;
const chipsEl = document.getElementById('chips') as HTMLElement;

function loadCollapsed(): Record<GameStatus, boolean> {
  const defaults: Record<GameStatus, boolean> = {
    'in-progress': false,
    'up-next': false,
    backlog: true,
    beat: true,
    abandoned: true,
  };
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    for (const status of STATUS_ORDER) {
      if (typeof saved[status] === 'boolean') defaults[status] = saved[status];
    }
  } catch {
    // Corrupt prefs: fall back to defaults.
  }
  return defaults;
}

function saveCollapsed(): void {
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(collapsed));
}

function rerender(): void {
  renderSections(sectionsEl, groupGames(store.getGames(), filter), {
    collapsed,
    filtering: isFiltering(filter),
  });
}

// --- Status filter chips ---
function buildChips(): void {
  const options: { value: GameStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  ];
  for (const { value, label } of options) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.value = value;
    chip.textContent = label;
    chip.setAttribute('aria-pressed', String(value === filter.status));
    chip.addEventListener('click', () => {
      filter.status = filter.status === value ? 'all' : value;
      for (const other of chipsEl.querySelectorAll<HTMLElement>('.chip')) {
        other.setAttribute('aria-pressed', String(other.dataset.value === filter.status));
      }
      rerender();
    });
    chipsEl.append(chip);
  }
}

// --- Search (debounced) ---
let searchTimer: ReturnType<typeof setTimeout> | undefined;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filter.query = searchEl.value;
    rerender();
  }, 150);
});

// --- Section + row interactions (event delegation) ---
sectionsEl.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target) return;
  if (target.dataset.action === 'toggle' && isGameStatus(target.dataset.status)) {
    collapsed[target.dataset.status] = !collapsed[target.dataset.status];
    saveCollapsed();
    rerender();
  } else if (target.dataset.action === 'edit' && target.dataset.id) {
    const game = store.getGame(target.dataset.id);
    if (game) openGameDialog(game);
  }
});

sectionsEl.addEventListener('change', (event) => {
  const target = event.target as HTMLSelectElement;
  if (target.dataset.action !== 'status' || !target.dataset.id) return;
  const status = target.value;
  if (!isGameStatus(status)) return;
  const game = store.updateGame(target.dataset.id, { status });
  if (game && status === 'beat' && game.rating === null) {
    openGameDialog(game, { focusRating: true });
  }
});

// --- Add / edit dialog ---
initDialog({
  onSave: (input, id) => {
    if (id) store.updateGame(id, input);
    else store.addGame(input);
  },
  onDelete: (id) => store.deleteGame(id),
});

(document.getElementById('add-btn') as HTMLButtonElement).addEventListener('click', () => {
  const defaultStatus = filter.status !== 'all' ? filter.status : 'backlog';
  openGameDialog(null, { defaultStatus });
});

// --- Overflow menu ---
const menuBtn = document.getElementById('menu-btn') as HTMLButtonElement;
const menu = document.getElementById('menu') as HTMLElement;
menuBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  menu.hidden = !menu.hidden;
  menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
});
document.addEventListener('click', () => {
  menu.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
});

// --- Backup: export ---
(document.getElementById('export-btn') as HTMLButtonElement).addEventListener('click', () => {
  downloadBackup(store.getDocument());
});

// --- Backup: import ---
const importDialog = document.getElementById('import-dialog') as HTMLDialogElement;
const importFile = document.getElementById('import-file') as HTMLInputElement;
let pendingImport: ReturnType<typeof store.getDocument> | null = null;

(document.getElementById('import-btn') as HTMLButtonElement).addEventListener('click', () => {
  importFile.value = '';
  importFile.click();
});

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    pendingImport = await parseBackupFile(file);
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Could not read that file.');
    return;
  }
  const summary = document.getElementById('import-summary') as HTMLElement;
  summary.textContent =
    `Backup contains ${pendingImport.games.length} game(s). ` +
    `You currently have ${store.getGames().length}. Merge keeps both (backup wins on conflicts); ` +
    `Replace discards your current list.`;
  importDialog.showModal();
});

(document.getElementById('import-merge-btn') as HTMLButtonElement).addEventListener('click', () => {
  if (pendingImport) store.mergeAll(pendingImport);
  pendingImport = null;
  importDialog.close();
});
(document.getElementById('import-replace-btn') as HTMLButtonElement).addEventListener(
  'click',
  () => {
    if (pendingImport) store.replaceAll(pendingImport);
    pendingImport = null;
    importDialog.close();
  },
);
(document.getElementById('import-cancel-btn') as HTMLButtonElement).addEventListener(
  'click',
  () => {
    pendingImport = null;
    importDialog.close();
  },
);

// --- Boot ---
store.onChange(rerender);
buildChips();
rerender();
