import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  DEFAULT_CONFIG,
  SESSION_SCHEMA_VERSION,
  parseConfig,
  type TelemetryConfig,
} from './contract.ts';
import { associate, listPullHeads } from './association.ts';
import { gitOk, readBlob } from './git.ts';
import {
  groupChanges,
  mainlineDiffs,
  readCommits,
  type Change,
} from './history.ts';
import {
  REGISTRY_SCHEMA_VERSION,
  webUrl,
  type Registry,
  type RegistryEntry,
} from './registry.ts';
import { computeReleases } from './releases.ts';
import { collectSessions, collectUnmergedSessions } from './sessions.ts';
import { collectSubscriptions } from './subscriptions.ts';
import {
  computeSignals,
  type ChangeFacts,
  type RepositorySignals,
} from './signals.ts';
import { mirrorPath, refTips } from './sync.ts';
import { timingFor } from './timing.ts';

export const PROJECTION_SCHEMA_VERSION = 5;
export const CONFIG_PATH = 'telemetry.config.json';

export type RepositoryProjection = {
  name: string;
  defaultBranch: string;
  /** The remote's browsable web URL, or null when the registry URL is not a hosting remote. */
  webUrl: string | null;
  reachable: boolean;
  reason: string | null;
  asOf: string | null;
  refTips: Record<string, string>;
  changes: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  unmerged: unknown[];
  releases: unknown[];
  unreleased: string[];
  movedTags: unknown[];
  signals: RepositorySignals | null;
};

export type Projection = {
  schemaVersion: number;
  sessionSchemaVersion: number;
  registrySchemaVersion: number;
  configSchemaVersion: number;
  builtAt: string;
  repositories: Record<string, RepositoryProjection>;
};

/** Canonical JSON: sorted keys at every level, two-space indent, trailing newline. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + '\n';
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (typeof value === 'object' && value !== null) {
    if (value instanceof Map) {
      return sortKeys(Object.fromEntries(value));
    }
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function projectionPath(root: string): string {
  return join(root, 'projection.json');
}

export function readProjection(root: string): Projection | null {
  const path = projectionPath(root);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Projection;
}

export function writeProjection(
  root: string,
  projection: Projection,
): { path: string; hash: string } {
  const path = projectionPath(root);
  mkdirSync(dirname(path), { recursive: true });
  const text = canonicalJson(projection);
  writeFileSync(path, text);
  return { path, hash: sha256(text) };
}

function configReader(
  dir: string,
): (revision: string | null) => TelemetryConfig {
  const cache = new Map<string, TelemetryConfig>();
  return (revision) => {
    if (!revision) {
      return DEFAULT_CONFIG;
    }
    const cached = cache.get(revision);
    if (cached) {
      return cached;
    }
    const text = readBlob(dir, revision, CONFIG_PATH);
    const config = text === null ? DEFAULT_CONFIG : parseConfig(text).config;
    cache.set(revision, config);
    return config;
  };
}

export function buildRepositoryProjection(
  root: string,
  entry: RegistryEntry,
  previous: RepositoryProjection | null,
): RepositoryProjection {
  const dir = mirrorPath(root, entry);
  const branch = entry.defaultBranch;
  if (!existsSync(dir) || !gitOk(dir, ['rev-parse', '--verify', branch])) {
    return {
      name: entry.name,
      defaultBranch: branch,
      webUrl: entry.webUrl ?? webUrl(entry.url),
      reachable: false,
      reason: existsSync(dir)
        ? `default branch ${branch} is not present in the mirror`
        : 'not synced',
      asOf: null,
      refTips: {},
      changes: [],
      sessions: [],
      subscriptions: [],
      unmerged: [],
      releases: [],
      unreleased: [],
      movedTags: [],
      signals: null,
    };
  }
  const configAtRevision = configReader(dir);
  const configAt = (change: Change) => configAtRevision(change.firstParent);
  const { changes, commits } = groupChanges(dir, branch);
  const pullHeads = listPullHeads(dir);
  const pullHeadByNumber = new Map(
    pullHeads.map((head) => [head.number, head]),
  );
  // Ages are measured as of the newest commit the mirror holds, so a rebuild is a function of the ref
  // tips rather than of the wall clock.
  const tipCommits = readCommits(dir, [
    branch,
    ...pullHeads.map((head) => head.tip),
  ]);
  const asOf =
    [...tipCommits.values()]
      .map((commit) => commit.committerDate)
      .sort()
      .at(-1) ?? null;
  const diffs = mainlineDiffs(dir, branch);
  const filesOf = (change: Change): string[] => {
    const files = new Set<string>();
    for (const hash of change.commits) {
      for (const file of diffs.get(hash)?.files ?? []) {
        files.add(file);
      }
    }
    return [...files].sort();
  };
  const { associations, unmerged } = associate(dir, branch, changes, pullHeads);
  const { sessions, byChange } = collectSessions(
    dir,
    changes,
    commits,
    configAt,
    filesOf,
  );
  collectUnmergedSessions(
    dir,
    branch,
    pullHeads,
    new Set(unmerged.map((entry) => entry.number)),
    sessions,
    configAtRevision(branch),
  );
  const previousTagTargets: Record<string, string> = {};
  for (const release of (previous?.releases ?? []) as {
    tag: string;
    commit: string;
  }[]) {
    previousTagTargets[release.tag] = release.commit;
  }
  const releaseView = computeReleases(
    dir,
    branch,
    entry.releaseTagPattern,
    changes,
    previousTagTargets,
  );
  const releaseDates = new Map(
    [
      ...readCommits(
        dir,
        releaseView.releases.map((release) => release.commit),
      ).values(),
    ].map((commit) => [commit.hash, commit.committerDate]),
  );
  const facts: ChangeFacts[] = changes.map((change) => {
    const association = associations.get(change.id)!;
    let insertions = 0;
    let deletions = 0;
    for (const hash of change.commits) {
      insertions += diffs.get(hash)?.insertions ?? 0;
      deletions += diffs.get(hash)?.deletions ?? 0;
    }
    return {
      change,
      association,
      timing: timingFor(dir, change, association, pullHeadByNumber),
      sessions: byChange.get(change.id)!,
      files: filesOf(change),
      insertions,
      deletions,
    };
  });
  const subscriptions = collectSubscriptions(dir, branch);
  const signals = computeSignals(
    facts,
    sessions,
    unmerged,
    releaseView.releases.map((release) => ({
      tag: release.tag,
      changes: release.changes,
      at: releaseDates.get(release.commit) ?? null,
    })),
    subscriptions,
    entry.thresholds,
    entry.reworkIgnore,
    configAt,
    asOf ?? '1970-01-01T00:00:00Z',
  );
  return {
    name: entry.name,
    defaultBranch: branch,
    webUrl: entry.webUrl ?? webUrl(entry.url),
    reachable: true,
    reason: null,
    asOf,
    refTips: refTips(dir),
    changes: facts.map((fact) => ({
      id: fact.change.id,
      kind: fact.change.kind,
      commits: fact.change.commits,
      firstParent: fact.change.firstParent,
      mergeCommit: fact.change.mergeCommit,
      subject: fact.change.subject,
      mergeTime: fact.change.mergeTime,
      trailers: fact.change.trailers,
      trailerSource: fact.change.trailerSource,
      association: fact.association,
      timing: fact.timing,
      sessions: fact.sessions,
      files: fact.files.length,
      insertions: fact.insertions,
      deletions: fact.deletions,
      releases: releaseView.releasedChanges.get(fact.change.id) ?? [],
      gaps: [...fact.change.gaps, ...fact.sessions.gaps],
      producer: 'git',
      trust: 'observed',
    })),
    sessions: [...sessions.values()]
      .sort((a, b) => a.sessionId.localeCompare(b.sessionId))
      .map((record) => ({ ...record })),
    subscriptions: subscriptions.map((record) => ({ ...record })),
    unmerged,
    releases: releaseView.releases,
    unreleased: releaseView.unreleased,
    movedTags: releaseView.movedTags,
    signals,
  };
}

export function buildProjection(root: string, registry: Registry): Projection {
  const previous = readProjection(root);
  const repositories: Record<string, RepositoryProjection> = {};
  for (const entry of registry.repositories) {
    repositories[entry.name] = buildRepositoryProjection(
      root,
      entry,
      previous?.repositories[entry.name] ?? null,
    );
  }
  return {
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    sessionSchemaVersion: SESSION_SCHEMA_VERSION,
    registrySchemaVersion: REGISTRY_SCHEMA_VERSION,
    configSchemaVersion: DEFAULT_CONFIG.schemaVersion,
    builtAt:
      'not recorded: the projection is a function of the ref tips, not of when it was built',
    repositories,
  };
}
