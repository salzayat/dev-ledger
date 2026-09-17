import { gitLines, isAncestor, patchIds, revList } from './git.ts';
import { readCommits, type Change } from './history.ts';

// Releases from tag ancestry. Membership is the changes reachable from a tag and not from the preceding
// release tag; a change carried by cherry-pick is resolved by reference or patch identity.

export type Release = {
  tag: string;
  commit: string;
  previousTag: string | null;
  changes: string[];
  unmapped: { commit: string; subject: string }[];
  cherryPicked: {
    commit: string;
    resolvedTo: string;
    method: 'reference' | 'patch-identity';
  }[];
};

export type ReleaseView = {
  releases: Release[];
  unreleased: string[];
  movedTags: { tag: string; previously: string; now: string }[];
  releasedChanges: Map<string, string[]>;
};

export function computeReleases(
  dir: string,
  branch: string,
  pattern: string,
  changes: Change[],
  previousTagTargets: Record<string, string> = {},
): ReleaseView {
  const tags = gitLines(dir, [
    'tag',
    '--list',
    pattern,
    '--format=%(refname:short) %(*objectname)%(objectname)',
  ])
    .map((line) => {
      const [tag, target] = line.split(' ');
      return { tag, commit: target.slice(0, 40) };
    })
    .filter(
      (entry) =>
        gitLines(dir, ['rev-list', '-n', '1', entry.commit]).length > 0,
    );
  const mainline = revList(dir, [
    '--first-parent',
    '--topo-order',
    '--reverse',
    branch,
  ]);
  const mainlineIndex = new Map(mainline.map((hash, index) => [hash, index]));
  const baseIndex = (commit: string): number => {
    if (isAncestor(dir, commit, branch)) {
      return (
        mainlineIndex.get(commit) ??
        indexOfAncestor(dir, commit, mainline, mainlineIndex)
      );
    }
    const base = gitLines(dir, ['merge-base', commit, branch])[0];
    return base
      ? (mainlineIndex.get(base) ??
          indexOfAncestor(dir, base, mainline, mainlineIndex))
      : -1;
  };
  const onMain = tags.map((entry) => ({
    ...entry,
    order: baseIndex(entry.commit),
  }));
  onMain.sort((a, b) => a.order - b.order || a.tag.localeCompare(b.tag));
  const changeByLast = new Map(
    changes.map((change) => [change.lastCommit, change]),
  );
  const mainPatchIds = patchIds(
    dir,
    changes.flatMap((change) => change.branchCommits),
  );
  const patchToChange = new Map<string, string>();
  for (const change of changes) {
    for (const hash of change.branchCommits) {
      const patchId = mainPatchIds.get(hash);
      if (patchId && !patchToChange.has(patchId)) {
        patchToChange.set(patchId, change.id);
      }
    }
  }
  const releases: Release[] = [];
  const releasedChanges = new Map<string, string[]>();
  let previousTag: string | null = null;
  let previousCommit: string | null = null;
  for (const entry of onMain) {
    const range = previousCommit
      ? [entry.commit, `^${previousCommit}`]
      : [entry.commit];
    const mainlineCommits = revList(dir, [
      '--first-parent',
      '--topo-order',
      '--reverse',
      ...range,
    ]);
    const members = mainlineCommits
      .filter((hash) => changeByLast.has(hash))
      .map((hash) => changeByLast.get(hash)!.id);
    const offMain = revList(dir, ['--reverse', entry.commit, `^${branch}`]);
    const unmapped: Release['unmapped'] = [];
    const cherryPicked: Release['cherryPicked'] = [];
    if (offMain.length > 0) {
      const offCommits = readCommits(dir, offMain);
      const offPatchIds = patchIds(dir, offMain);
      for (const [hash, commit] of offCommits) {
        const reference = /\(cherry picked from commit ([0-9a-f]{7,40})\)/.exec(
          commit.message,
        );
        const referenced = reference
          ? changes.find((change) =>
              change.branchCommits.some((c) => c.startsWith(reference[1])),
            )?.id
          : undefined;
        const byPatch = offPatchIds.get(hash)
          ? patchToChange.get(offPatchIds.get(hash)!)
          : undefined;
        const resolved = referenced ?? byPatch;
        if (resolved) {
          cherryPicked.push({
            commit: hash,
            resolvedTo: resolved,
            method: referenced ? 'reference' : 'patch-identity',
          });
          if (!members.includes(resolved)) {
            members.push(resolved);
          }
        } else {
          unmapped.push({ commit: hash, subject: commit.subject });
        }
      }
    }
    for (const id of members) {
      const list = releasedChanges.get(id) ?? [];
      list.push(entry.tag);
      releasedChanges.set(id, list);
    }
    releases.push({
      tag: entry.tag,
      commit: entry.commit,
      previousTag,
      changes: members,
      unmapped,
      cherryPicked,
    });
    previousTag = entry.tag;
    previousCommit = entry.commit;
  }
  const unreleased = changes
    .filter((change) => !releasedChanges.has(change.id))
    .map((change) => change.id);

  const movedTags = tags
    .filter(
      (entry) =>
        previousTagTargets[entry.tag] &&
        previousTagTargets[entry.tag] !== entry.commit,
    )
    .map((entry) => ({
      tag: entry.tag,
      previously: previousTagTargets[entry.tag],
      now: entry.commit,
    }));
  return { releases, unreleased, movedTags, releasedChanges };
}

/** A commit reachable from the mainline but not on it (a branch commit) ranks with the mainline commit that brought it in. */
function indexOfAncestor(
  dir: string,
  commit: string,
  mainline: string[],
  mainlineIndex: Map<string, number>,
): number {
  for (const hash of mainline) {
    if (isAncestor(dir, commit, hash)) {
      return mainlineIndex.get(hash) ?? -1;
    }
  }
  return -1;
}
