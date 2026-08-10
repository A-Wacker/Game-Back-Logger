export type GameStatus = 'in-progress' | 'up-next' | 'backlog' | 'beat' | 'abandoned';

export const STATUS_ORDER: readonly GameStatus[] = [
  'in-progress',
  'up-next',
  'backlog',
  'beat',
  'abandoned',
];

export const STATUS_LABELS: Record<GameStatus, string> = {
  'in-progress': 'In-Progress',
  'up-next': 'Up Next',
  backlog: 'Backlog',
  beat: 'Beat',
  abandoned: 'Abandoned',
};

export function isGameStatus(value: unknown): value is GameStatus {
  return (STATUS_ORDER as readonly unknown[]).includes(value);
}

export interface Game {
  id: string;
  title: string;
  status: GameStatus;
  /** 1–5, meaningful when status is 'beat' */
  rating: number | null;
  /** 'YYYY-MM-DD' */
  startedDate: string | null;
  /** 'YYYY-MM-DD' */
  finishedDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreDocument {
  schemaVersion: 1;
  games: Game[];
}
