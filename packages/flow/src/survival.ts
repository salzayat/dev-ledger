import { git, gitLines } from './git.ts';
import type { Change } from './history.ts';
import type { Release } from './releases.ts';
import { matchesGlob } from './signals.ts';

// What a release actually contains of the work it carries. A change a tag reaches may have been
// overwritten before the tag was cut; blame at the tag says which lines each change still owns there.

export type Survival = {
  /** The release tag the change shipped in. */
  tag: string;
  /** Lines the change's commits added, outside the ignored paths. */
  added: number;
  /** Of those, the lines blame at the tag still attributes to the change. */
  surviving: number;
};

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export function computeSurvival(
  dir: string,
  releases: Release[],
  changes: Change[],
  ignore: string[],
): Map<string, Survival> {
  const byId = new Map(changes.map((change) => [change.id, change]));
  const ignored = (path: string) =>
    ignore.some((glob) => matchesGlob(path, glob));
  const result = new Map<string, Survival>();
  let previousCommit: string | null = null;
  for (const release of releases) {
    const members = release.changes
      .map((id) => byId.get(id))
      .filter((change): change is Change => change !== undefined)
      .filter((change) => !result.has(change.id));
    const owner = new Map<string, string>();
    for (const change of members) {
      for (const hash of [
        ...change.commits,
        ...change.branchCommits,
        change.lastCommit,
        ...(change.mergeCommit ? [change.mergeCommit] : []),
      ]) {
        owner.set(hash, change.id);
      }
    }
    for (const pick of release.cherryPicked) {
      owner.set(pick.commit, pick.resolvedTo);
    }
    const added = new Map<string, number>();
    const owned = [...owner.keys()];
    if (owned.length > 0) {
      let current: string | null = null;
      for (const line of git(
        dir,
        [
          'log',
          '--no-walk=unsorted',
          '--no-merges',
          '--numstat',
          '--format=@%H',
          '--stdin',
        ],
        owned.join('\n') + '\n',
      ).split('\n')) {
        if (line.startsWith('@')) {
          current = line.slice(1);
          continue;
        }
        const [insertions, , path] = line.split('\t');
        if (!current || !path || insertions === '-' || ignored(path)) {
          continue;
        }
        const id = owner.get(current)!;
        added.set(id, (added.get(id) ?? 0) + Number(insertions));
      }
    }
    const surviving = new Map<string, number>();
    const files = gitLines(dir, [
      'diff',
      '--numstat',
      previousCommit ?? EMPTY_TREE,
      release.commit,
    ])
      .map((line) => line.split('\t'))
      .filter(
        ([insertions, , path]) =>
          insertions !== '-' && Number(insertions) > 0 && !ignored(path),
      )
      .map(([, , path]) => path);
    for (const path of files) {
      for (const line of gitLines(dir, [
        'blame',
        '--porcelain',
        release.commit,
        '--',
        path,
      ])) {
        const header = /^([0-9a-f]{40}) \d+ \d+ (\d+)$/.exec(line);
        const id = header ? owner.get(header[1]) : undefined;
        if (header && id) {
          surviving.set(id, (surviving.get(id) ?? 0) + Number(header[2]));
        }
      }
    }
    for (const change of members) {
      const lines = added.get(change.id) ?? 0;
      // A merge that resolved conflicts owns lines no single commit added; survival never exceeds addition.
      result.set(change.id, {
        tag: release.tag,
        added: lines,
        surviving: Math.min(lines, surviving.get(change.id) ?? 0),
      });
    }
    previousCommit = release.commit;
  }
  return result;
}
