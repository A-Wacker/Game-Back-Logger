import { validateDocument } from './store';
import type { StoreDocument } from './types';

export function downloadBackup(doc: StoreDocument): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `game-backlog-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Resolves with a validated document; rejects with a user-facing message. */
export async function parseBackupFile(file: File): Promise<StoreDocument> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const doc = validateDocument(parsed);
  if (!doc) {
    throw new Error('That file is not a Game Back-Logger backup.');
  }
  return doc;
}
