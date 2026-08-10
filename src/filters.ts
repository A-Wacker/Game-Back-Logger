import { STATUS_ORDER, type Game, type GameStatus } from './types';

export interface FilterState {
  query: string;
  status: GameStatus | 'all';
}

export function isFiltering(filter: FilterState): boolean {
  return filter.query.trim() !== '' || filter.status !== 'all';
}

/** Filter, group by status, and sort each group. Pure — no DOM, no store. */
export function groupGames(
  games: readonly Game[],
  filter: FilterState,
): Record<GameStatus, Game[]> {
  const query = filter.query.trim().toLowerCase();
  const grouped: Record<GameStatus, Game[]> = {
    'in-progress': [],
    'up-next': [],
    backlog: [],
    beat: [],
  };
  for (const game of games) {
    if (filter.status !== 'all' && game.status !== filter.status) continue;
    if (query && !game.title.toLowerCase().includes(query)) continue;
    grouped[game.status].push(game);
  }
  for (const status of STATUS_ORDER) {
    grouped[status].sort(status === 'beat' ? compareBeat : compareByUpdated);
  }
  return grouped;
}

function compareByUpdated(a: Game, b: Game): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

/** Beat: most recently finished first, undated last. */
function compareBeat(a: Game, b: Game): number {
  if (a.finishedDate && b.finishedDate) return b.finishedDate.localeCompare(a.finishedDate);
  if (a.finishedDate) return -1;
  if (b.finishedDate) return 1;
  return compareByUpdated(a, b);
}
