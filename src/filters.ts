import type { Game, GameStatus } from './types';

export interface FilterState {
  query: string;
  status: GameStatus | 'all';
}

export function isFiltering(filter: FilterState): boolean {
  return filter.query.trim() !== '' || filter.status !== 'all';
}

/**
 * Filter and group by status. Pure — no DOM, no store. Array order is the
 * user's manual order, so groups preserve it rather than sorting.
 */
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
    abandoned: [],
  };
  for (const game of games) {
    if (filter.status !== 'all' && game.status !== filter.status) continue;
    if (query && !game.title.toLowerCase().includes(query)) continue;
    grouped[game.status].push(game);
  }
  return grouped;
}
