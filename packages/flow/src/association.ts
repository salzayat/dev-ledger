import { git, gitLines, patchIds } from './git.ts';
import type { Change } from './history.ts';

// Associate each change with a pull request from git alone: the number in a squash or merge subject, a
// pull head whose tip sits inside the change, or patch identity against a fetched pull head ref. A change
// that matches none of them is out-of-band.

export type Association = {
  pullRequest: number | null;
  method: 'subject' | 'pull-head' | 'patch-identity' | null;
  classification: 'pull-request' | 'out-of-band';
};

export type PullHead = { number: number; ref: string; tip: string };

export type UnmergedPullRequest = {
  number: number;
  tip: string;
  oldestCommitAt: string | null;
  commits: number;
  note: string;
};

export function listPullHeads(dir: string): PullHead[] {
  const heads: PullHead[] = [];
  for (const line of gitLines(dir, [
    'for-each-ref',
    '--format=%(refname) %(objectname)',
    'refs/pull',
  ])) {
    const [ref, tip] = line.split(' ');
    const match = /^refs\/pull\/(\d+)\/head$/.exec(ref);
    if (match) {
      heads.push({ number: Number(match[1]), ref, tip });
    }
  }
  return heads.sort((a, b) => a.number - b.number);
}

export function subjectPullRequest(subject: string): number | null {
  const squash = /\(#(\d+)\)\s*$/.exec(subject);
  if (squash) {
    return Number(squash[1]);
  }
  const merge = /^Merge pull request #(\d+)\b/.exec(subject);
  return merge ? Number(merge[1]) : null;
}

type OffMainCommit = { hash: string; authorDate: string; number: number };

/** Every commit reachable from a pull head but not from the default branch, with the ref it came from. */
function commitsOffMain(
  dir: string,
  branch: string,
  pullHeads: PullHead[],
): OffMainCommit[] {
  if (pullHeads.length === 0) {
    return [];
  }
  const output = git(dir, [
    'log',
    '--format=%H %aI %S',
    '--source',
    '--no-merges',
    ...pullHeads.map((head) => head.ref),
    `^${branch}`,
  ]);
  const result: OffMainCommit[] = [];
  for (const line of output.split('\n')) {
    const [hash, authorDate, source] = line.trim().split(' ');
    const match = source ? /^refs\/pull\/(\d+)\/head$/.exec(source) : null;
    if (hash && match) {
      result.push({ hash, authorDate, number: Number(match[1]) });
    }
  }
  return result;
}

export function associate(
  dir: string,
  branch: string,
  changes: Change[],
  pullHeads: PullHead[],
): { associations: Map<string, Association>; unmerged: UnmergedPullRequest[] } {
  const offMain = commitsOffMain(dir, branch, pullHeads);
  const offMainByNumber = new Map<number, OffMainCommit[]>();
  for (const commit of offMain) {
    const list = offMainByNumber.get(commit.number) ?? [];
    list.push(commit);
    offMainByNumber.set(commit.number, list);
  }
  const offMainNumber = new Map(
    offMain.map((commit) => [commit.hash, commit.number]),
  );
  const pullPatchToNumber = new Map<string, number>();
  for (const [hash, patchId] of patchIds(
    dir,
    offMain.map((commit) => commit.hash),
  )) {
    const number = offMainNumber.get(hash);
    if (number !== undefined && !pullPatchToNumber.has(patchId)) {
      pullPatchToNumber.set(patchId, number);
    }
  }
  const mainlinePatchIds = patchIds(
    dir,
    changes.flatMap((change) => change.branchCommits),
  );

  // A pull head whose tip commit is on the default branch (a fast-forward, a rebase that rewrote nothing,
  // or a merge commit's second parent) names its change directly.
  const mergedTips = new Set(
    gitLines(dir, [
      'for-each-ref',
      '--merged',
      branch,
      '--format=%(objectname)',
      'refs/pull',
    ]),
  );
  const tipToNumber = new Map<string, number>();
  for (const head of pullHeads) {
    if (mergedTips.has(head.tip)) {
      tipToNumber.set(head.tip, head.number);
    }
  }

  const associations = new Map<string, Association>();
  const associatedNumbers = new Set<number>();
  // A subject number is only unique within one repository. A fork inherits squash subjects that name the
  // upstream repository's pull requests, so a merge is accepted as a pull head's merge only when it did
  // not happen before that pull head's commits existed.
  const subjectMergeTime = new Map<number, string>();
  for (const change of changes) {
    const fromSubject = subjectPullRequest(change.subject);
    if (fromSubject !== null) {
      associations.set(change.id, {
        pullRequest: fromSubject,
        method: 'subject',
        classification: 'pull-request',
      });
      const previous = subjectMergeTime.get(fromSubject);
      if (previous === undefined || previous < change.mergeTime) {
        subjectMergeTime.set(fromSubject, change.mergeTime);
      }
      continue;
    }
    const fromTip = change.commits
      .map((hash) => tipToNumber.get(hash))
      .find((number) => number !== undefined);
    if (fromTip !== undefined) {
      associations.set(change.id, {
        pullRequest: fromTip,
        method: 'pull-head',
        classification: 'pull-request',
      });
      associatedNumbers.add(fromTip);
      continue;
    }
    let matched: number | null = null;
    for (const hash of change.branchCommits) {
      const patchId = mainlinePatchIds.get(hash);
      const number = patchId ? pullPatchToNumber.get(patchId) : undefined;
      if (number !== undefined) {
        matched = number;
        break;
      }
    }
    if (matched !== null) {
      associations.set(change.id, {
        pullRequest: matched,
        method: 'patch-identity',
        classification: 'pull-request',
      });
      associatedNumbers.add(matched);
    } else {
      associations.set(change.id, {
        pullRequest: null,
        method: null,
        classification: 'out-of-band',
      });
    }
  }
  const unmerged: UnmergedPullRequest[] = [];
  for (const head of pullHeads) {
    const commits = offMainByNumber.get(head.number) ?? [];
    const oldest = commits.map((commit) => commit.authorDate).sort()[0] ?? null;
    const subjectMerge = subjectMergeTime.get(head.number);
    const mergedBySubject =
      subjectMerge !== undefined &&
      (oldest === null || Date.parse(subjectMerge) >= Date.parse(oldest));
    if (
      associatedNumbers.has(head.number) ||
      mergedTips.has(head.tip) ||
      mergedBySubject
    ) {
      continue;
    }
    unmerged.push({
      number: head.number,
      tip: head.tip,
      oldestCommitAt: oldest,
      commits: commits.length,
      note: 'open or closed is not observable from git',
    });
  }
  return { associations, unmerged };
}
