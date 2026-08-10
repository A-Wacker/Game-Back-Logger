import { STATUS_LABELS, STATUS_ORDER, type Game, type GameStatus } from './types';

export interface RenderOptions {
  /** Persisted per-section collapse state (ignored while filtering). */
  collapsed: Record<GameStatus, boolean>;
  /** While filtering: expand everything, hide empty sections. */
  filtering: boolean;
  /** Show drag handles (off while a search hides part of a section). */
  reorderable: boolean;
}

export function renderSections(
  container: HTMLElement,
  grouped: Record<GameStatus, Game[]>,
  opts: RenderOptions,
): void {
  const sections: HTMLElement[] = [];
  for (const status of STATUS_ORDER) {
    const games = grouped[status];
    if (opts.filtering && games.length === 0) continue;
    const expanded = opts.filtering || !opts.collapsed[status];
    sections.push(buildSection(status, games, expanded, opts.reorderable));
  }
  if (sections.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No games match.';
    container.replaceChildren(empty);
    return;
  }
  container.replaceChildren(...sections);
}

function buildSection(
  status: GameStatus,
  games: Game[],
  expanded: boolean,
  reorderable: boolean,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'status-section';
  section.dataset.status = status;

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'section-header';
  header.dataset.action = 'toggle';
  header.dataset.status = status;
  header.setAttribute('aria-expanded', String(expanded));

  const dot = document.createElement('span');
  dot.className = `status-dot status-${status}`;
  const label = document.createElement('span');
  label.className = 'section-label';
  label.textContent = STATUS_LABELS[status];
  const count = document.createElement('span');
  count.className = 'count-badge';
  count.textContent = String(games.length);
  const chevron = document.createElement('span');
  chevron.className = 'chevron';
  chevron.textContent = expanded ? '▾' : '▸';
  header.append(dot, label, count, chevron);
  section.append(header);

  if (expanded) {
    if (games.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Nothing here yet.';
      section.append(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'game-list';
      for (const game of games) list.append(buildRow(game, reorderable));
      section.append(list);
    }
  }
  return section;
}

function buildRow(game: Game, reorderable: boolean): HTMLElement {
  const row = document.createElement('li');
  row.className = 'game-row';

  if (reorderable) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'drag-handle';
    handle.dataset.id = game.id;
    handle.setAttribute('aria-label', `Reorder ${game.title}`);
    handle.textContent = '☰';
    row.append(handle);
  }

  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'row-main';
  main.dataset.action = 'edit';
  main.dataset.id = game.id;

  const title = document.createElement('span');
  title.className = 'game-title';
  title.textContent = game.title;
  main.append(title);

  const meta = buildMeta(game);
  if (meta) main.append(meta);

  const statusSelect = document.createElement('select');
  statusSelect.className = 'row-status';
  statusSelect.dataset.action = 'status';
  statusSelect.dataset.id = game.id;
  statusSelect.setAttribute('aria-label', `Status of ${game.title}`);
  for (const status of STATUS_ORDER) {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = STATUS_LABELS[status];
    option.selected = status === game.status;
    statusSelect.append(option);
  }

  row.append(main, statusSelect);
  return row;
}

/**
 * 'YYYY-MM-DD' -> 'MM-DD-YY' for the compact list rows. Sliced rather than
 * parsed as a Date so a local timezone can't shift the day.
 */
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}-${m[3]}-${m[1].slice(2)}` : iso;
}

function buildMeta(game: Game): HTMLElement | null {
  const parts: string[] = [];
  if (game.status === 'beat') {
    if (game.rating) parts.push('★'.repeat(game.rating) + '☆'.repeat(5 - game.rating));
    if (game.finishedDate) parts.push(`Finished ${shortDate(game.finishedDate)}`);
  } else if (game.status === 'in-progress' && game.startedDate) {
    parts.push(`Started ${shortDate(game.startedDate)}`);
  }
  if (game.notes.trim()) parts.push('📝');
  if (parts.length === 0) return null;
  const meta = document.createElement('span');
  meta.className = 'game-meta';
  meta.textContent = parts.join(' · ');
  return meta;
}
