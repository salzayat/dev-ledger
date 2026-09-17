import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { git, gitLines, GitError } from './git.ts';
import type { Registry, RegistryEntry } from './registry.ts';

// `telemetry sync`: mirror-fetch every registered repository with the operator's own git access. The
// mirror holds branches, tags, and pull head refs; the ref tips it fetched are recorded so two machines
// can tell whether they rebuilt from the same inputs.

export const REFSPECS = [
  '+refs/heads/*:refs/heads/*',
  '+refs/tags/*:refs/tags/*',
  '+refs/pull/*/head:refs/pull/*/head',
];

export type SyncResult = {
  name: string;
  mirror: string;
  reachable: boolean;
  reason?: string;
  refTips: Record<string, string>;
};

export function mirrorPath(root: string, entry: RegistryEntry): string {
  return join(root, 'mirrors', `${entry.name}.git`);
}

export function syncRepository(root: string, entry: RegistryEntry): SyncResult {
  const mirror = mirrorPath(root, entry);
  try {
    if (!existsSync(mirror)) {
      mkdirSync(mirror, { recursive: true });
      git(mirror, ['init', '--bare', '--quiet']);
      git(mirror, ['remote', 'add', 'origin', entry.url]);
    } else {
      git(mirror, ['remote', 'set-url', 'origin', entry.url]);
    }
    git(mirror, ['fetch', '--quiet', '--prune', 'origin', ...REFSPECS]);
    return {
      name: entry.name,
      mirror,
      reachable: true,
      refTips: refTips(mirror),
    };
  } catch (error) {
    const reason =
      error instanceof GitError
        ? error.stderr.trim()
        : (error as Error).message;
    return {
      name: entry.name,
      mirror,
      reachable: false,
      reason,
      refTips: existsSync(mirror) ? safeRefTips(mirror) : {},
    };
  }
}

export function syncAll(root: string, registry: Registry): SyncResult[] {
  return registry.repositories.map((entry) => syncRepository(root, entry));
}

export function refTips(mirror: string): Record<string, string> {
  const tips: Record<string, string> = {};
  for (const line of gitLines(mirror, [
    'for-each-ref',
    '--format=%(refname) %(objectname)',
    'refs/heads',
    'refs/tags',
    'refs/pull',
  ])) {
    const [ref, sha] = line.split(' ');
    tips[ref] = sha;
  }
  return tips;
}

function safeRefTips(mirror: string): Record<string, string> {
  try {
    return refTips(mirror);
  } catch {
    return {};
  }
}
