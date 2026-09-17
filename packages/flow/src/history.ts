import {
  SINGLE_VALUED_TRAILERS,
  parseTrailers,
  type TrailerKey,
  type Trailers,
} from '@dev-ledger/capture';
import { git, revList } from './git.ts';

// Walk the default branch's first-parent history and group commits into changes: a squash is one
// commit, a merge commit brings its branch commits in through the second parent, and a rebase merge is
// a run of single-parent commits sharing a `Change:` trailer.

export type Commit = {
  hash: string;
  parents: string[];
  authorDate: string;
  committerDate: string;
  subject: string;
  message: string;
  trailers: Trailers;
};

export type Gap = {
  type: 'conflicting-trailer' | 'undeclared-session' | 'missing-session-record';
  detail: string;
};

export type Change = {
  id: string;
  kind: 'squash-or-single' | 'merge-commit' | 'rebase-run';
  commits: string[];
  branchCommits: string[];
  firstParent: string | null;
  lastCommit: string;
  mergeCommit: string | null;
  subject: string;
  mergeTime: string;
  trailers: Record<string, string | string[]>;
  trailerSource: 'merge-message' | 'commits' | 'none';
  gaps: Gap[];
};

const FIELD = '\x1f';
const RECORD = '\x1e';

export function readCommits(
  dir: string,
  revisions: string[],
): Map<string, Commit> {
  const format = ['%H', '%P', '%aI', '%cI', '%s', '%B'].join(FIELD) + RECORD;
  const output = git(
    dir,
    ['log', `--format=${format}`, '--no-walk=unsorted', '--stdin'],
    revisions.join('\n') + '\n',
  );
  const commits = new Map<string, Commit>();
  for (const record of output.split(RECORD)) {
    if (record.trim().length === 0) {
      continue;
    }
    const [hash, parents, authorDate, committerDate, subject, message] = record
      .replace(/^\n/, '')
      .split(FIELD);
    commits.set(hash, {
      hash,
      parents: parents ? parents.split(' ') : [],
      authorDate,
      committerDate,
      subject,
      message,
      trailers: parseTrailers(message),
    });
  }
  return commits;
}

export function firstParentHistory(dir: string, branch: string): string[] {
  return revList(dir, ['--first-parent', '--topo-order', '--reverse', branch]);
}

export function groupChanges(
  dir: string,
  branch: string,
): { changes: Change[]; commits: Map<string, Commit> } {
  const mainline = firstParentHistory(dir, branch);
  const commits = readCommits(dir, mainline);
  const changes: Change[] = [];
  for (const hash of mainline) {
    const commit = commits.get(hash);
    if (!commit) {
      continue;
    }
    if (commit.parents.length >= 2) {
      const branchCommits = revList(dir, [
        '--topo-order',
        '--reverse',
        commit.parents[1],
        `^${commit.parents[0]}`,
      ]);
      for (const [key, value] of readCommits(dir, branchCommits)) {
        commits.set(key, value);
      }
      changes.push(
        finishChange(
          {
            kind: 'merge-commit',
            commits: [...branchCommits, hash],
            branchCommits,
            firstParent: commit.parents[0],
            mergeCommit: hash,
          },
          commits,
        ),
      );
      continue;
    }
    const changeId = commit.trailers.Change?.[0];
    const previous = changes[changes.length - 1];
    if (
      changeId &&
      previous &&
      previous.kind !== 'merge-commit' &&
      previous.lastCommit === commit.parents[0] &&
      commits.get(previous.lastCommit)?.trailers.Change?.[0] === changeId
    ) {
      changes[changes.length - 1] = finishChange(
        {
          kind: 'rebase-run',
          commits: [...previous.commits, hash],
          branchCommits: [...previous.commits, hash],
          firstParent: previous.firstParent,
          mergeCommit: null,
        },
        commits,
      );
      continue;
    }
    changes.push(
      finishChange(
        {
          kind: 'squash-or-single',
          commits: [hash],
          branchCommits: [hash],
          firstParent: commit.parents[0] ?? null,
          mergeCommit: null,
        },
        commits,
      ),
    );
  }
  return { changes, commits };
}

function finishChange(
  partial: Pick<
    Change,
    'kind' | 'commits' | 'branchCommits' | 'firstParent' | 'mergeCommit'
  >,
  commits: Map<string, Commit>,
): Change {
  const lastCommit = partial.commits[partial.commits.length - 1];
  const last = commits.get(lastCommit)!;
  const gaps: Gap[] = [];
  const mergeMessageTrailers = partial.mergeCommit
    ? commits.get(partial.mergeCommit)!.trailers
    : partial.kind === 'squash-or-single'
      ? last.trailers
      : {};
  let trailers: Record<string, string | string[]> = {};
  let trailerSource: Change['trailerSource'] = 'none';
  if (Object.keys(mergeMessageTrailers).length > 0) {
    trailerSource = 'merge-message';
    trailers = flatten(mergeMessageTrailers, gaps);
  } else {
    const union: Trailers = {};
    for (const hash of partial.branchCommits) {
      for (const [key, values] of Object.entries(
        commits.get(hash)?.trailers ?? {},
      )) {
        (union[key as TrailerKey] ??= []).push(...values);
      }
    }
    if (Object.keys(union).length > 0) {
      trailerSource = 'commits';
      trailers = flatten(union, gaps);
    }
  }
  return {
    id: lastCommit,
    kind: partial.kind,
    commits: partial.commits,
    branchCommits: partial.branchCommits,
    firstParent: partial.firstParent,
    lastCommit,
    mergeCommit: partial.mergeCommit,
    subject: last.subject,
    mergeTime: last.committerDate,
    trailers,
    trailerSource,
    gaps,
  };
}

function flatten(
  trailers: Trailers,
  gaps: Gap[],
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, values] of Object.entries(trailers)) {
    const distinct = [...new Set(values)];
    if (SINGLE_VALUED_TRAILERS.includes(key as TrailerKey)) {
      if (distinct.length > 1) {
        gaps.push({
          type: 'conflicting-trailer',
          detail: `${key} carries ${distinct.join(', ')}`,
        });
      } else {
        result[key] = distinct[0];
      }
    } else {
      result[key] = distinct;
    }
  }
  return result;
}

export type CommitDiff = {
  files: string[];
  insertions: number;
  deletions: number;
};

/** One call: for every first-parent commit, the files and line counts of its diff against its first parent. */
export function mainlineDiffs(
  dir: string,
  branch: string,
): Map<string, CommitDiff> {
  const output = git(dir, [
    'log',
    '--first-parent',
    '--numstat',
    '--format=%x1e%H',
    branch,
  ]);
  const result = new Map<string, CommitDiff>();
  for (const record of output.split('\x1e')) {
    const lines = record.split('\n').filter((line) => line.length > 0);
    if (lines.length === 0) {
      continue;
    }
    const hash = lines[0].trim();
    const diff: CommitDiff = { files: [], insertions: 0, deletions: 0 };
    for (const line of lines.slice(1)) {
      const [added, removed, ...rest] = line.split('\t');
      const path = rest.join('\t');
      if (!path) {
        continue;
      }
      diff.files.push(path);
      diff.insertions += Number(added) || 0;
      diff.deletions += Number(removed) || 0;
    }
    result.set(hash, diff);
  }
  return result;
}
