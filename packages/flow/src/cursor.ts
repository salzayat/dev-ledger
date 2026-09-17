import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gitOk, isAncestor, revList } from './git.ts';

// A consumer keeps, per repository, the last default-branch commit it processed and replays forward in
// topological order. A cursor that is no longer reachable resets to the nearest reachable ancestor.

export type CursorFile = Record<string, string>;

export type CursorRun = {
  repository: string;
  from: string | null;
  to: string | null;
  processed: string[];
  reset: { invalid: string; resetTo: string | null } | null;
};

export function cursorPath(root: string, consumer: string): string {
  return join(root, 'cursors', `${consumer}.json`);
}

export function readCursor(root: string, consumer: string): CursorFile {
  const path = cursorPath(root, consumer);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as CursorFile)
    : {};
}

export function writeCursor(
  root: string,
  consumer: string,
  cursor: CursorFile,
): void {
  const path = cursorPath(root, consumer);
  mkdirSync(join(root, 'cursors'), { recursive: true });
  writeFileSync(path, JSON.stringify(cursor, null, 2) + '\n');
}

export function advanceCursor(
  dir: string,
  branch: string,
  repository: string,
  cursor: CursorFile,
): CursorRun {
  const mainline = revList(dir, [
    '--first-parent',
    '--topo-order',
    '--reverse',
    branch,
  ]);
  const tip = mainline[mainline.length - 1] ?? null;
  let from: string | null = cursor[repository] ?? null;
  let reset: CursorRun['reset'] = null;
  if (
    from &&
    !(gitOk(dir, ['cat-file', '-e', from]) && isAncestor(dir, from, branch))
  ) {
    const invalid = from;
    let resetTo: string | null = null;
    if (gitOk(dir, ['cat-file', '-e', invalid])) {
      for (const candidate of revList(dir, [invalid])) {
        if (isAncestor(dir, candidate, branch)) {
          resetTo = candidate;
          break;
        }
      }
    }
    reset = { invalid, resetTo };
    from = resetTo;
  }
  const start = from ? mainline.indexOf(from) + 1 : 0;
  const processed = mainline.slice(start);
  if (tip) {
    cursor[repository] = tip;
  }
  return { repository, from, to: tip, processed, reset };
}
