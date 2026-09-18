import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './git.ts';

// Builds small, deterministic git repositories for tests and for the end-to-end verification runs. Every
// commit's dates are fixed so two builds of the same fixture produce the same hashes.

export type FixtureRepo = {
  dir: string;
  nextPull: number;
  clock: number;
};

const START = Date.parse('2026-09-01T09:00:00Z');

export function makeFixtureRepo(): FixtureRepo {
  const dir = mkdtempSync(join(tmpdir(), 'dev-ledger-fixture-'));
  git(dir, ['init', '--quiet', '-b', 'main']);
  git(dir, ['config', 'user.name', 'contributor']);
  git(dir, ['config', 'user.email', 'contributor@example.invalid']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  const repo: FixtureRepo = { dir, nextPull: 1, clock: START };
  commit(
    repo,
    'chore(repo): initial commit',
    { 'README.md': '# fixture\n' },
    { hours: 0 },
  );
  return repo;
}

function stamp(
  repo: FixtureRepo,
  advance: { hours?: number; minutes?: number },
): string {
  repo.clock +=
    (advance.hours ?? 0) * 3_600_000 + (advance.minutes ?? 0) * 60_000;
  return new Date(repo.clock).toISOString();
}

function env(date: string): Record<string, string> {
  return { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
}

export function writeFiles(
  repo: FixtureRepo,
  files: Record<string, string>,
): void {
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(repo.dir, path);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, content);
  }
}

export function commit(
  repo: FixtureRepo,
  message: string,
  files: Record<string, string>,
  advance: { hours?: number; minutes?: number } = { hours: 1 },
): string {
  writeFiles(repo, files);
  git(repo.dir, ['add', '-A']);
  const date = stamp(repo, advance);
  gitWithEnv(
    repo.dir,
    ['commit', '--quiet', '--allow-empty', '-m', message],
    env(date),
  );
  return git(repo.dir, ['rev-parse', 'HEAD']).trim();
}

function gitWithEnv(
  dir: string,
  args: string[],
  extra: Record<string, string>,
): string {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(extra)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    return git(dir, args);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export type PullRequestFixture = {
  number: number;
  branch: string;
  commits: string[];
  mergedAs: string | null;
};

/**
 * Opens a pull request: a branch with the given commits, its tip recorded as `refs/pull/N/head`. Each
 * commit is `[message, files]`, and trailers may be appended to the message by the caller.
 */
export function openPullRequest(
  repo: FixtureRepo,
  branch: string,
  commits: [string, Record<string, string>][],
  advance: { hours?: number; minutes?: number } = { hours: 1 },
): PullRequestFixture {
  git(repo.dir, ['switch', '--quiet', '-c', branch, 'main']);
  const hashes = commits.map(([message, files]) =>
    commit(repo, message, files, advance),
  );
  const number = repo.nextPull;
  repo.nextPull += 1;
  git(repo.dir, [
    'update-ref',
    `refs/pull/${number}/head`,
    hashes[hashes.length - 1],
  ]);
  git(repo.dir, ['switch', '--quiet', 'main']);
  return { number, branch, commits: hashes, mergedAs: null };
}

export function mergeSquash(
  repo: FixtureRepo,
  pull: PullRequestFixture,
  subject: string,
  body = '',
  advance = { hours: 4 },
): string {
  git(repo.dir, ['merge', '--squash', '--quiet', pull.branch]);
  const date = stamp(repo, advance);
  const message = body
    ? `${subject} (#${pull.number})\n\n${body}`
    : `${subject} (#${pull.number})`;
  gitWithEnv(repo.dir, ['commit', '--quiet', '-m', message], env(date));
  pull.mergedAs = git(repo.dir, ['rev-parse', 'HEAD']).trim();
  return pull.mergedAs;
}

export function mergeCommit(
  repo: FixtureRepo,
  pull: PullRequestFixture,
  advance = { hours: 4 },
): string {
  const date = stamp(repo, advance);
  gitWithEnv(
    repo.dir,
    [
      'merge',
      '--no-ff',
      '--quiet',
      '-m',
      `Merge pull request #${pull.number} from contributor/${pull.branch}`,
      pull.branch,
    ],
    env(date),
  );
  pull.mergedAs = git(repo.dir, ['rev-parse', 'HEAD']).trim();
  return pull.mergedAs;
}

export function mergeRebase(
  repo: FixtureRepo,
  pull: PullRequestFixture,
  advance = { hours: 4 },
): string[] {
  const date = stamp(repo, advance);
  git(repo.dir, ['switch', '--quiet', pull.branch]);
  gitWithEnv(repo.dir, ['rebase', '--quiet', '--force-rebase', 'main'], {
    GIT_COMMITTER_DATE: date,
  });
  const rewritten = git(repo.dir, ['rev-list', '--reverse', 'HEAD', '^main'])
    .trim()
    .split('\n');
  git(repo.dir, ['switch', '--quiet', 'main']);
  git(repo.dir, ['merge', '--ff-only', '--quiet', pull.branch]);
  pull.mergedAs = rewritten[rewritten.length - 1];
  return rewritten;
}

export function directPush(
  repo: FixtureRepo,
  message: string,
  files: Record<string, string>,
  advance = { hours: 2 },
): string {
  return commit(repo, message, files, advance);
}

export function tag(repo: FixtureRepo, name: string): void {
  git(repo.dir, ['tag', name]);
}

export function sessionJson(
  sessionId: string,
  overrides: Record<string, unknown> = {},
): string {
  return (
    JSON.stringify(
      {
        schemaVersion: 1,
        sessionId,
        provider: 'provider-a',
        model: 'model-x',
        inputTokens: 1000,
        outputTokens: 200,
        cachedTokens: 100,
        costUsd: 0.5,
        figuresSource: 'harness',
        startedAt: '2026-09-01T09:00:00Z',
        endedAt: '2026-09-01T10:00:00Z',
        wallClockSeconds: 3600,
        agentRunSeconds: 1800,
        billingKind: 'metered',
        branch: 'fixture',
        commits: [],
        localCheck: { outcome: 'passed', command: 'npm run check' },
        ...overrides,
      },
      null,
      2,
    ) + '\n'
  );
}

export function subscriptionJson(
  planId: string,
  period: string,
  amount: number,
  overrides: Record<string, unknown> = {},
): string {
  return (
    JSON.stringify(
      {
        schemaVersion: 1,
        planId,
        period,
        amount,
        currency: 'USD',
        overageAmount: 0,
        ...overrides,
      },
      null,
      2,
    ) + '\n'
  );
}

export function trailered(
  subject: string,
  trailers: Record<string, string>,
): string {
  const lines = Object.entries(trailers).map(
    ([key, value]) => `${key}: ${value}`,
  );
  return `${subject}\n\n${lines.join('\n')}`;
}
