import { execFileSync } from 'node:child_process';

// A thin, synchronous git wrapper. Every read the projection makes goes through here, against a local
// mirror, so a rebuild needs no network and no credential.

export class GitError extends Error {
  readonly args: string[];
  readonly stderr: string;

  constructor(args: string[], stderr: string) {
    super(`git ${args.join(' ')} failed: ${stderr.trim()}`);
    this.args = args;
    this.stderr = stderr;
  }
}

export function git(dir: string, args: string[], input?: string): string {
  try {
    return execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      input,
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
    });
  } catch (error) {
    const failure = error as { stderr?: string | Buffer; message: string };
    throw new GitError(args, String(failure.stderr ?? failure.message));
  }
}

export function gitLines(
  dir: string,
  args: string[],
  input?: string,
): string[] {
  return git(dir, args, input)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

export function gitOk(dir: string, args: string[]): boolean {
  try {
    git(dir, args);
    return true;
  } catch {
    return false;
  }
}

export function isAncestor(
  dir: string,
  ancestor: string,
  descendant: string,
): boolean {
  return gitOk(dir, ['merge-base', '--is-ancestor', ancestor, descendant]);
}

export function revList(dir: string, args: string[]): string[] {
  return gitLines(dir, ['rev-list', ...args]);
}

/** Maps commit hash to stable patch identity for the listed commits (merges are skipped by git). */
export function patchIds(
  dir: string,
  revisions: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  if (revisions.length === 0) {
    return result;
  }
  const log = git(
    dir,
    [
      'log',
      '-p',
      '--no-color',
      '--format=%H',
      '--no-merges',
      '--no-walk=unsorted',
      '--stdin',
    ],
    revisions.join('\n') + '\n',
  );
  if (log.trim().length === 0) {
    return result;
  }
  for (const line of gitLines(dir, ['patch-id', '--stable'], log)) {
    const [patchId, commit] = line.split(/\s+/);
    if (patchId && commit) {
      result.set(commit, patchId);
    }
  }
  return result;
}

export function treeFiles(
  dir: string,
  revision: string,
  path: string,
): string[] {
  if (!gitOk(dir, ['rev-parse', '--verify', `${revision}:${path}`])) {
    return [];
  }
  return gitLines(dir, ['ls-tree', '-r', '--name-only', revision, '--', path]);
}

export function readBlob(
  dir: string,
  revision: string,
  path: string,
): string | null {
  try {
    return git(dir, ['show', `${revision}:${path}`]);
  } catch {
    return null;
  }
}

export function changedFiles(
  dir: string,
  from: string | null,
  to: string,
): string[] {
  return from
    ? gitLines(dir, ['diff', '--name-only', from, to])
    : gitLines(dir, ['ls-tree', '-r', '--name-only', to]);
}

export function diffStat(
  dir: string,
  from: string | null,
  to: string,
): { insertions: number; deletions: number } {
  const args = from
    ? ['diff', '--numstat', from, to]
    : ['show', '--numstat', '--format=', to];
  let insertions = 0;
  let deletions = 0;
  for (const line of gitLines(dir, args)) {
    const [added, removed] = line.split('\t');
    insertions += Number(added) || 0;
    deletions += Number(removed) || 0;
  }
  return { insertions, deletions };
}
