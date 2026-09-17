import { gitLines } from './git.ts';
import type { Change } from './history.ts';
import type { Association, PullHead } from './association.ts';

// Cycle time and wait time read from the pull head ref's original commits, so a squash or a rebase
// merge does not erase them. Absent with a reason when there is no pull head, never zero.

export type Timing = {
  cycleTimeSeconds: number | null;
  waitTimeSeconds: number | null;
  reason: 'no-pull-request' | 'no-pull-head' | 'no-branch-commits' | null;
  mergeTime: string;
  mergeClock: 'merging party';
  firstAuthoredAt: string | null;
  lastAuthoredAt: string | null;
};

export function timingFor(
  dir: string,
  change: Change,
  association: Association,
  pullHeads: Map<number, PullHead>,
): Timing {
  const base = {
    cycleTimeSeconds: null,
    waitTimeSeconds: null,
    mergeTime: change.mergeTime,
    mergeClock: 'merging party' as const,
    firstAuthoredAt: null,
    lastAuthoredAt: null,
  };
  if (association.pullRequest === null) {
    return { ...base, reason: 'no-pull-request' };
  }
  const head = pullHeads.get(association.pullRequest);
  if (!head) {
    return { ...base, reason: 'no-pull-head' };
  }
  const range = change.firstParent
    ? [head.tip, `^${change.firstParent}`]
    : [head.tip];
  const dates = gitLines(dir, ['log', '--format=%aI', ...range]).sort();
  if (dates.length === 0) {
    return { ...base, reason: 'no-branch-commits' };
  }
  const merged = Date.parse(change.mergeTime);
  const first = dates[0];
  const last = dates[dates.length - 1];
  return {
    cycleTimeSeconds: Math.max(
      0,
      Math.round((merged - Date.parse(first)) / 1000),
    ),
    waitTimeSeconds: Math.max(
      0,
      Math.round((merged - Date.parse(last)) / 1000),
    ),
    reason: null,
    mergeTime: change.mergeTime,
    mergeClock: 'merging party',
    firstAuthoredAt: first,
    lastAuthoredAt: last,
  };
}
