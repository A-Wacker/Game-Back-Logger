import { STATUS_ORDER, isGameStatus, type Game, type GameStatus, type StoreDocument } from './types';

const STORAGE_KEY = 'game-back-logger:v1';

type Listener = () => void;
const listeners: Listener[] = [];

let doc: StoreDocument = load();

export function onChange(fn: Listener): void {
  listeners.push(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

function emptyDoc(): StoreDocument {
  return { schemaVersion: 1, games: [] };
}

function load(): StoreDocument {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDoc();
    return validateDocument(JSON.parse(raw)) ?? emptyDoc();
  } catch {
    return emptyDoc();
  }
}

function save(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  notify();
}

export function getGames(): readonly Game[] {
  return doc.games;
}

export function getGame(id: string): Game | undefined {
  return doc.games.find((g) => g.id === id);
}

export function getDocument(): StoreDocument {
  return doc;
}

export type GameInput = Pick<Game, 'title' | 'status' | 'rating' | 'startedDate' | 'finishedDate' | 'notes'>;

/** Insert a game at the top of its status group (array order IS display order). */
function insertAtGroupTop(game: Game): void {
  const firstIdx = doc.games.findIndex((g) => g.status === game.status);
  if (firstIdx === -1) doc.games.push(game);
  else doc.games.splice(firstIdx, 0, game);
}

export function addGame(input: GameInput): Game {
  const now = new Date().toISOString();
  const game: Game = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now };
  insertAtGroupTop(game);
  save();
  return game;
}

export function updateGame(id: string, patch: Partial<GameInput>): Game | undefined {
  const idx = doc.games.findIndex((g) => g.id === id);
  if (idx === -1) return undefined;
  const game = doc.games[idx];
  const statusChanged = patch.status !== undefined && patch.status !== game.status;
  Object.assign(game, patch, { updatedAt: new Date().toISOString() });
  if (statusChanged) {
    doc.games.splice(idx, 1);
    insertAtGroupTop(game);
  }
  save();
  return game;
}

/** Move a game to a new position (index within its own status group). */
export function reorderGame(id: string, newIndex: number): void {
  const game = doc.games.find((g) => g.id === id);
  if (!game) return;
  doc.games.splice(doc.games.indexOf(game), 1);
  const group = doc.games.filter((g) => g.status === game.status);
  if (newIndex >= group.length) {
    const last = group[group.length - 1];
    doc.games.splice(last ? doc.games.indexOf(last) + 1 : doc.games.length, 0, game);
  } else {
    doc.games.splice(doc.games.indexOf(group[newIndex]), 0, game);
  }
  save();
}

/**
 * One-time switch from computed sorting to manual ordering: seed the array
 * order from the sort the app used to display, so nothing visibly moves.
 */
export function migrateToManualOrder(): void {
  const byUpdated = (a: Game, b: Game) => b.updatedAt.localeCompare(a.updatedAt);
  const byFinished = (a: Game, b: Game) => {
    if (a.finishedDate && b.finishedDate) return b.finishedDate.localeCompare(a.finishedDate);
    if (a.finishedDate) return -1;
    if (b.finishedDate) return 1;
    return byUpdated(a, b);
  };
  doc.games = STATUS_ORDER.flatMap((status) =>
    doc.games.filter((g) => g.status === status).sort(status === 'beat' ? byFinished : byUpdated),
  );
  save();
}

export function deleteGame(id: string): void {
  const index = doc.games.findIndex((g) => g.id === id);
  if (index === -1) return;
  doc.games.splice(index, 1);
  save();
}

export function replaceAll(imported: StoreDocument): void {
  doc = imported;
  save();
}

/** Union by id; incoming games win on conflict. */
export function mergeAll(imported: StoreDocument): void {
  const byId = new Map(doc.games.map((g) => [g.id, g]));
  for (const game of imported.games) byId.set(game.id, game);
  doc = { schemaVersion: 1, games: [...byId.values()] };
  save();
}

/**
 * Coerce unknown data into a valid StoreDocument, or null if the overall
 * shape is unusable. Individual games missing a title are dropped; other
 * bad fields are coerced to safe defaults.
 */
export function validateDocument(data: unknown): StoreDocument | null {
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.games)) return null;
  const games: Game[] = [];
  for (const item of candidate.games) {
    const game = coerceGame(item);
    if (game) games.push(game);
  }
  return { schemaVersion: 1, games };
}

function coerceGame(item: unknown): Game | null {
  if (typeof item !== 'object' || item === null) return null;
  const raw = item as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;
  const now = new Date().toISOString();
  const status: GameStatus = isGameStatus(raw.status) ? raw.status : 'backlog';
  const rating =
    typeof raw.rating === 'number' && raw.rating >= 1 && raw.rating <= 5
      ? Math.round(raw.rating)
      : null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    title,
    status,
    rating,
    startedDate: typeof raw.startedDate === 'string' && raw.startedDate ? raw.startedDate : null,
    finishedDate: typeof raw.finishedDate === 'string' && raw.finishedDate ? raw.finishedDate : null,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
  };
}
