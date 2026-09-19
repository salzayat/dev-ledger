/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { renderLedger } from './ledger.ts';
import { linksFor, renderLedgerHtml } from './ledger-html.ts';
import { renderConfigurationPage } from './configuration-html.ts';
import {
  applyWrite,
  serveConfiguration,
  writablePath,
} from './configuration-server.ts';
import { configurationGaps } from './subscriptions.ts';
import { advanceCursor } from './cursor.ts';
import {
  commit,
  directPush,
  writeFiles,
  makeFixtureRepo,
  mergeCommit,
  mergeRebase,
  mergeSquash,
  openPullRequest,
  sessionJson,
  subscriptionJson,
  tag,
  trailered,
} from './fixture.ts';
import { git, gitEnvironment } from './git.ts';
import {
  buildProjection,
  canonicalJson,
  sha256,
  writeProjection,
  type RepositoryProjection,
} from './projection.ts';
import { parseRegistry, type Registry } from './registry.ts';
import { buildStatement, statementCsv } from './statement.ts';
import { mirrorPath, syncAll } from './sync.ts';

function registryFor(
  dir: string,
  name = 'fixture',
  thresholds: Record<string, number> = {},
): Registry {
  return parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        {
          name,
          url: dir,
          defaultBranch: 'main',
          releaseTagPattern: 'v*',
          thresholds,
        },
      ],
    }),
  ).registry;
}

function stateRoot(): string {
  return mkdtempSync(join(tmpdir(), 'dev-ledger-state-'));
}

function build(registry: Registry, state = stateRoot()) {
  syncAll(state, registry);
  const projection = buildProjection(state, registry);
  writeProjection(state, projection);
  return {
    state,
    projection,
    repo: projection.repositories[registry.repositories[0].name],
  };
}

function change(repo: RepositoryProjection, id: string) {
  const found = repo.changes.find((entry) => entry.id === id) as
    Record<string, any> | undefined;
  assert.ok(found, `change ${id} present`);
  return found;
}

test('five pull requests merged interleaved by three methods are each recorded once', () => {
  const fixture = makeFixtureRepo();
  const a = openPullRequest(fixture, 'a', [
    [
      trailered('feat(a): one', {
        Spec: 'add-a',
        Session: 'none',
        Change: 'c-a',
      }),
      { 'a.txt': 'a' },
    ],
  ]);
  const b = openPullRequest(fixture, 'b', [
    [
      trailered('feat(b): two', { Session: 'none', Change: 'c-b' }),
      { 'b.txt': 'b' },
    ],
    [
      trailered('feat(b): two more', { Session: 'none', Change: 'c-b' }),
      { 'b2.txt': 'b' },
    ],
  ]);
  const c = openPullRequest(fixture, 'c', [
    [
      trailered('feat(c): three', { Session: 'none', Change: 'c-c' }),
      { 'c.txt': 'c' },
    ],
  ]);
  const d = openPullRequest(fixture, 'd', [
    [
      trailered('feat(d): four', { Session: 'none', Change: 'c-d' }),
      { 'd.txt': 'd' },
    ],
  ]);
  const e = openPullRequest(fixture, 'e', [
    [
      trailered('feat(e): five', { Session: 'none', Change: 'c-e' }),
      { 'e.txt': 'e' },
    ],
  ]);
  mergeSquash(fixture, a, 'feat(a): one', 'Spec: add-a\nSession: none');
  mergeRebase(fixture, b);
  mergeCommit(fixture, c);
  mergeSquash(fixture, d, 'feat(d): four');
  mergeRebase(fixture, e);
  const { repo } = build(registryFor(fixture.dir));
  const pullRequests = repo.changes.map(
    (entry) =>
      (entry.association as { pullRequest: number | null }).pullRequest,
  );
  assert.deepEqual(pullRequests, [null, 1, 2, 3, 4, 5]);
  const methods = repo.changes.map(
    (entry) => (entry.association as { method: string | null }).method,
  );
  assert.deepEqual(methods, [
    null,
    'subject',
    'patch-identity',
    'subject',
    'subject',
    'patch-identity',
  ]);
  assert.equal(change(repo, b.mergedAs!).kind, 'rebase-run');
  assert.equal(change(repo, b.mergedAs!).commits.length, 2);
  assert.equal(change(repo, c.mergedAs!).kind, 'merge-commit');
  assert.equal(change(repo, a.mergedAs!).trailers.Spec, 'add-a');
  assert.equal(change(repo, a.mergedAs!).trailerSource, 'merge-message');
  assert.equal(change(repo, b.mergedAs!).trailerSource, 'commits');
});

test('a direct push is out-of-band and an unmerged pull head is listed with its age', () => {
  const fixture = makeFixtureRepo();
  const merged = openPullRequest(fixture, 'm', [
    [
      trailered('feat(m): merged', { Session: 'none', Change: 'c-m' }),
      { 'm.txt': 'm' },
    ],
  ]);
  mergeSquash(fixture, merged, 'feat(m): merged');
  openPullRequest(fixture, 'open', [
    [
      trailered('feat(open): waiting', { Session: 'none', Change: 'c-o' }),
      { 'open.txt': 'o' },
    ],
  ]);
  directPush(fixture, 'chore(repo): pushed straight to main', {
    'oops.txt': 'x',
  });
  const { repo } = build(registryFor(fixture.dir));
  const classifications = repo.changes.map(
    (entry) => (entry.association as { classification: string }).classification,
  );
  assert.deepEqual(classifications, [
    'out-of-band',
    'pull-request',
    'out-of-band',
  ]);
  assert.equal(repo.unmerged.length, 1);
  const unmerged = repo.unmerged[0] as {
    number: number;
    oldestCommitAt: string;
    note: string;
  };
  assert.equal(unmerged.number, 2);
  assert.ok(unmerged.oldestCommitAt);
  assert.match(unmerged.note, /not observable/);
  assert.ok(
    repo.signals!.queue.oldestAgeSeconds! > 0,
    'age is measured as of the newest commit the mirror holds',
  );
  assert.ok(repo.asOf, 'the projection records the as-of time');
});

test('wait time survives a rebase merge and absent timing is never zero', () => {
  const fixture = makeFixtureRepo();
  const pull = openPullRequest(
    fixture,
    'r',
    [
      [
        trailered('feat(r): first', { Session: 'none', Change: 'c-r' }),
        { 'r1.txt': '1' },
      ],
      [
        trailered('feat(r): last', { Session: 'none', Change: 'c-r' }),
        { 'r2.txt': '2' },
      ],
    ],
    { hours: 1 },
  );
  mergeRebase(fixture, pull, { hours: 72 });
  directPush(fixture, 'chore(repo): direct', { 'x.txt': 'x' });
  const { repo } = build(registryFor(fixture.dir));
  const rebased = change(repo, pull.mergedAs!);
  assert.equal(rebased.timing.waitTimeSeconds, 72 * 3600);
  assert.equal(rebased.timing.cycleTimeSeconds, 73 * 3600);
  const direct = repo.changes[repo.changes.length - 1] as Record<string, any>;
  assert.equal(direct.timing.cycleTimeSeconds, null);
  assert.equal(direct.timing.reason, 'no-pull-request');
  assert.equal(repo.signals!.waitTime.count, 1);
  assert.equal(repo.signals!.waitTime.excluded['no-pull-request'], 2);
});

test('sessions are attributed, undeclared and unreported are counted rather than zeroed', () => {
  const fixture = makeFixtureRepo();
  const reported = openPullRequest(fixture, 's', [
    [
      trailered('feat(s): work', {
        Spec: 'add-s',
        Session: 's-1',
        Change: 'c-s',
      }),
      { 's.txt': 's' },
    ],
    [
      trailered('chore(telemetry): record session s-1', {
        Session: 's-1',
        Change: 'c-s',
      }),
      {
        '.telemetry/sessions/2026-09/s-1.json': sessionJson('s-1', {
          spec: 'add-s',
        }),
      },
    ],
  ]);
  mergeSquash(
    fixture,
    reported,
    'feat(s): work',
    'Spec: add-s\nSession: s-1\nStory-Points: 5',
  );
  const unreported = openPullRequest(fixture, 'u', [
    [
      trailered('feat(u): no file', { Session: 's-2', Change: 'c-u' }),
      { 'u.txt': 'u' },
    ],
  ]);
  mergeSquash(fixture, unreported, 'feat(u): no file', 'Session: s-2');
  const undeclared = openPullRequest(fixture, 'n', [
    ['feat(n): no trailer at all', { 'n.txt': 'n' }],
  ]);
  mergeSquash(fixture, undeclared, 'feat(n): no trailer at all');
  const abandoned = openPullRequest(fixture, 'x', [
    [
      trailered('feat(x): abandoned', { Session: 's-9', Change: 'c-x' }),
      {
        '.telemetry/sessions/2026-09/s-9.json': sessionJson('s-9', {
          costUsd: 2,
        }),
      },
    ],
  ]);
  void abandoned;
  const { repo } = build(registryFor(fixture.dir));
  const signals = repo.signals!;
  assert.equal(change(repo, reported.mergedAs!).sessions.status, 'declared');
  assert.deepEqual(change(repo, reported.mergedAs!).sessions.sessions, ['s-1']);
  assert.deepEqual(change(repo, unreported.mergedAs!).sessions.unreported, [
    's-2',
  ]);
  assert.equal(
    change(repo, undeclared.mergedAs!).sessions.status,
    'undeclared',
  );
  assert.equal(signals.spend.total.costUsd, 0.5);
  assert.equal(signals.spend.excluded.unreported, 1);
  assert.equal(
    signals.spend.excluded.undeclared,
    2,
    'the initial commit and the untrailered change',
  );
  assert.equal(signals.spend.bySpec['add-s'].costUsd, 0.5);
  assert.equal(signals.spend.byProvider['provider-a'].sessions, 1);
  assert.equal(signals.spend.perEffortUnit.storyPoints.costPerUnit, 0.1);
  assert.equal(signals.spend.perEffortUnit.storyPoints.excluded, 3);
  assert.equal(signals.spend.unmergedPullRequests.costUsd, 2);
  assert.equal(signals.localChecks.passed, 1);
  const sessionRecord = repo.sessions.find(
    (entry) => entry.sessionId === 's-1',
  ) as Record<string, any>;
  assert.equal(sessionRecord.trust, 'reported');
  assert.equal(sessionRecord.producer, 'harness');
  const gapTypes = repo.changes.flatMap((entry) =>
    (entry.gaps as { type: string }[]).map((gap) => gap.type),
  );
  assert.ok(gapTypes.includes('missing-session-record'));
  assert.ok(gapTypes.includes('undeclared-session'));
});

test('conflicting single-valued trailers across a rebase run are a gap', () => {
  const fixture = makeFixtureRepo();
  const pull = openPullRequest(fixture, 'k', [
    [
      trailered('feat(k): one', {
        Session: 'none',
        Change: 'c-k',
        Spec: 'add-one',
      }),
      { 'k1.txt': '1' },
    ],
    [
      trailered('feat(k): two', {
        Session: 'none',
        Change: 'c-k',
        Spec: 'add-two',
      }),
      { 'k2.txt': '2' },
    ],
  ]);
  mergeRebase(fixture, pull);
  const { repo } = build(registryFor(fixture.dir));
  const rebased = change(repo, pull.mergedAs!);
  assert.equal(rebased.trailers.Spec, undefined);
  assert.ok(
    (rebased.gaps as { type: string }[]).some(
      (gap) => gap.type === 'conflicting-trailer',
    ),
  );
});

test('releases follow tag ancestry, cherry-picks resolve, unreleased work is listed, moved tags reported', () => {
  const fixture = makeFixtureRepo();
  const one = openPullRequest(fixture, 'one', [
    [
      trailered('feat(one): first', { Session: 'none', Change: 'c-1' }),
      { 'one.txt': '1' },
    ],
  ]);
  mergeSquash(fixture, one, 'feat(one): first');
  tag(fixture, 'v0.1.0');
  const two = openPullRequest(fixture, 'two', [
    [
      trailered('feat(two): second', { Session: 'none', Change: 'c-2' }),
      { 'two.txt': '2' },
    ],
  ]);
  mergeSquash(fixture, two, 'feat(two): second');
  git(fixture.dir, ['switch', '--quiet', '-c', 'release-0.2', 'v0.1.0']);
  git(fixture.dir, ['cherry-pick', '-x', two.mergedAs!]);
  git(fixture.dir, ['tag', 'v0.2.0']);
  git(fixture.dir, ['switch', '--quiet', 'main']);
  const three = openPullRequest(fixture, 'three', [
    [
      trailered('feat(three): third', { Session: 'none', Change: 'c-3' }),
      { 'three.txt': '3' },
    ],
  ]);
  mergeSquash(fixture, three, 'feat(three): third');
  const registry = registryFor(fixture.dir);
  const { state, repo } = build(registry);
  const releases = repo.releases as {
    tag: string;
    changes: string[];
    cherryPicked: { resolvedTo: string; method: string }[];
  }[];
  assert.deepEqual(
    releases.map((release) => release.tag),
    ['v0.1.0', 'v0.2.0'],
  );
  assert.deepEqual(releases[0].changes, [fixture_root(repo), one.mergedAs!]);
  assert.deepEqual(releases[1].changes, [two.mergedAs!]);
  assert.equal(releases[1].cherryPicked[0].method, 'reference');
  assert.equal(releases[1].cherryPicked[0].resolvedTo, two.mergedAs);
  assert.deepEqual(change(repo, two.mergedAs!).releases, ['v0.2.0']);
  assert.deepEqual(repo.unreleased, [three.mergedAs!]);
  git(fixture.dir, ['tag', '-f', 'v0.1.0', two.mergedAs!]);
  const moved = build(registry, state).repo;
  assert.deepEqual(
    (moved.movedTags as { tag: string }[]).map((entry) => entry.tag),
    ['v0.1.0'],
  );
});

function fixture_root(repo: RepositoryProjection): string {
  return repo.changes[0].id as string;
}

test('two states synced from the same repository rebuild byte-identically', () => {
  const fixture = makeFixtureRepo();
  const pull = openPullRequest(fixture, 'p', [
    [
      trailered('feat(p): thing', { Session: 'none', Change: 'c-p' }),
      { 'p.txt': 'p' },
    ],
  ]);
  mergeSquash(fixture, pull, 'feat(p): thing');
  const registry = registryFor(fixture.dir);
  const first = build(registry);
  const second = build(registry);
  const a = canonicalJson(first.projection);
  const b = canonicalJson(second.projection);
  assert.equal(a, b);
  assert.equal(sha256(a), sha256(b));
  assert.deepEqual(first.repo.refTips, second.repo.refTips);
});

test('an overridden fetch URL changes the transport and nothing else', () => {
  const fixture = makeFixtureRepo();
  const other = makeFixtureRepo();
  const registryJson = JSON.stringify({
    schemaVersion: 1,
    repositories: [
      { name: 'primary', url: join(tmpdir(), 'dev-ledger-unreachable-url') },
      { name: 'other', url: other.dir },
    ],
  });
  const registry = parseRegistry(registryJson).registry;

  // Without the override the registry URL is unreachable; with it, the same repository is fetched from
  // somewhere else and the ref tips recorded are the ones that source advertises.
  const plain = syncAll(stateRoot(), registry);
  assert.equal(plain.find((r) => r.name === 'primary')!.reachable, false);

  const overridden = syncAll(stateRoot(), registry, {
    name: 'primary',
    url: fixture.dir,
  });
  const primary = overridden.find((r) => r.name === 'primary')!;
  assert.equal(primary.reachable, true);

  // The same source fetched without an override records byte-identical tips.
  const direct = syncAll(
    stateRoot(),
    parseRegistry(
      JSON.stringify({
        schemaVersion: 1,
        repositories: [{ name: 'primary', url: fixture.dir }],
      }),
    ).registry,
  );
  assert.deepEqual(primary.refTips, direct[0].refTips);

  // The override applies to the named entry alone, and the registry itself is untouched.
  assert.equal(overridden.find((r) => r.name === 'other')!.reachable, true);
  assert.equal(
    JSON.stringify(parseRegistry(registryJson).registry),
    JSON.stringify(registry),
  );
});

test('an unreachable repository is named and the rest still build', () => {
  const fixture = makeFixtureRepo();
  const registry = parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        { name: 'ok', url: fixture.dir },
        { name: 'gone', url: join(tmpdir(), 'dev-ledger-missing-repo') },
      ],
    }),
  ).registry;
  const state = stateRoot();
  const results = syncAll(state, registry);
  assert.equal(
    results.find((result) => result.name === 'gone')!.reachable,
    false,
  );
  const projection = buildProjection(state, registry);
  assert.equal(projection.repositories.gone.reachable, false);
  assert.equal(projection.repositories.ok.reachable, true);
  assert.match(renderLedger(projection), /1 unreachable \(gone\)/);
});

test('thresholds raise signals that cite the changes behind them', () => {
  const fixture = makeFixtureRepo();
  const slow = openPullRequest(fixture, 'slow', [
    [
      trailered('feat(slow): waited', { Session: 'none', Change: 'c-slow' }),
      { 'slow.txt': 's' },
    ],
  ]);
  mergeSquash(fixture, slow, 'feat(slow): waited', '', { hours: 100 });
  const { repo } = build(
    registryFor(fixture.dir, 'fixture', { waitTimeP50Seconds: 3600 }),
  );
  const signal = repo.signals!.signals.find(
    (entry) => entry.signal === 'wait-time-p50',
  );
  assert.ok(signal);
  assert.deepEqual(signal!.cites, [slow.mergedAs]);
});

test('rework and escapes are detected from files and release tags', () => {
  const fixture = makeFixtureRepo();
  const first = openPullRequest(fixture, 'f1', [
    [
      trailered('feat(f): add', { Session: 'none', Change: 'c-f1' }),
      { 'src/f.ts': 'v1' },
    ],
  ]);
  mergeSquash(fixture, first, 'feat(f): add');
  tag(fixture, 'v1.0.0');
  const fix = openPullRequest(fixture, 'f2', [
    [
      trailered('fix(f): repair', { Session: 'none', Change: 'c-f2' }),
      { 'src/f.ts': 'v2' },
    ],
  ]);
  mergeSquash(fixture, fix, 'fix(f): repair');
  const { repo } = build(registryFor(fixture.dir));
  assert.equal(repo.signals!.rework.pairs.length, 1);
  assert.deepEqual(repo.signals!.rework.pairs[0].files, ['src/f.ts']);
  assert.equal(repo.signals!.escapes.release, 'v1.0.0');
  assert.deepEqual(
    repo.signals!.escapes.changes.map((entry) => entry.kind),
    ['fix'],
  );
});

test('a cursor resumes, is idempotent, and resets when its commit is unreachable', () => {
  const fixture = makeFixtureRepo();
  const first = openPullRequest(fixture, 'c1', [
    [
      trailered('feat(c): one', { Session: 'none', Change: 'c-c1' }),
      { 'c1.txt': '1' },
    ],
  ]);
  mergeSquash(fixture, first, 'feat(c): one');
  const registry = registryFor(fixture.dir);
  const state = stateRoot();
  syncAll(state, registry);
  const mirror = mirrorPath(state, registry.repositories[0]);
  const cursor: Record<string, string> = {};
  const run1 = advanceCursor(mirror, 'main', 'fixture', cursor);
  assert.equal(run1.processed.length, 2);
  const run2 = advanceCursor(mirror, 'main', 'fixture', cursor);
  assert.equal(run2.processed.length, 0);
  const second = openPullRequest(fixture, 'c2', [
    [
      trailered('feat(c): two', { Session: 'none', Change: 'c-c2' }),
      { 'c2.txt': '2' },
    ],
  ]);
  mergeSquash(fixture, second, 'feat(c): two');
  syncAll(state, registry);
  const run3 = advanceCursor(mirror, 'main', 'fixture', cursor);
  assert.deepEqual(run3.processed, [second.mergedAs]);
  cursor.fixture = second.commits[0];
  const run4 = advanceCursor(mirror, 'main', 'fixture', cursor);
  assert.ok(run4.reset);
  assert.equal(run4.reset!.invalid, second.commits[0]);
});

test('the ledger renders an empty state and never a person dimension', () => {
  assert.match(renderLedger(null), /The Ledger is empty/);
  const fixture = makeFixtureRepo();
  const { projection } = build(registryFor(fixture.dir));
  const text = renderLedger(projection);
  assert.match(text, /no changes on the default branch yet|cycle time/);
  // The operator dimension is now a read, so the ledger may name an operator. What it must never do is
  // resolve one to a person: no name, no email address, no author.
  assert.doesNotMatch(text, /author|@[a-z0-9.-]+\.[a-z]{2,}/i);
});

test('the operator dimension keeps agents in currency, humans in hours, and neither in the other', () => {
  const fixture = makeFixtureRepo();
  writeFiles(fixture, {
    'telemetry.config.json': JSON.stringify({
      schemaVersion: 1,
      costAllocation: {
        enabled: true,
        idleCapSeconds: 900,
        operators: ['op-1'],
        costClasses: ['rd', 'production'],
      },
    }),
  });
  commit(fixture, 'chore(repo): enable cost allocation', {});

  const worked = openPullRequest(fixture, 'w1', [
    [
      trailered('feat(w): agent and human', {
        Session: 's-op',
        Change: 'c-w1',
      }),
      {
        'src/w.ts': 'v1',
        '.telemetry/subscriptions/2026-09/plan-x.json': subscriptionJson(
          'plan-x',
          '2026-09',
          100,
        ),
        '.telemetry/sessions/2026-09/s-op.json': sessionJson('s-op', {
          billingKind: 'subscription',
          subscriptionId: 'plan-x',
          costUsd: 0,
          agentRunSeconds: 3600,
          operatorActiveSeconds: 5400,
          operatorActiveAlgorithm: 'idle-cap-v1:900',
          operatorId: 'op-1',
        }),
      },
    ],
  ]);
  mergeSquash(fixture, worked, 'feat(w): agent and human', 'Session: s-op', {
    hours: 24,
  });

  // A change declaring human-only work has hours no record holds: excluded and counted, never zero.
  const alone = openPullRequest(fixture, 'h1', [
    [
      trailered('docs(h): by hand', { Session: 'none', Change: 'c-h1' }),
      { 'docs/h.md': 'hand' },
    ],
  ]);
  mergeSquash(fixture, alone, 'docs(h): by hand', 'Session: none', {
    hours: 24,
  });

  const { repo, projection } = build(registryFor(fixture.dir));
  const operators = repo.signals.operators;

  // The human is measured in hours, from operatorActiveSeconds alone.
  assert.ok(operators.humans['op-1'], 'the declared operator is a dimension');
  assert.equal(operators.humans['op-1'].hours, 1.5);
  assert.equal(operators.humans['op-1'].sessions, 1);

  // The agent is measured in the subscription's currency: the sole eligible session takes the whole period.
  const agent = operators.agents['provider-a/model-x'];
  assert.ok(agent, 'the agent operator is a dimension');
  assert.equal(agent.currencies.USD.amount, 100);

  // Human-only work is counted as an exclusion rather than read as an operator working no hours.
  assert.equal(operators.excluded.humanOnly, 1);

  // No figure crosses the two units, and no identifier resolves to a person.
  const html = renderLedgerHtml(projection);
  assert.match(html, /op-1/);
  assert.match(html, /1\.5 h/);
  assert.doesNotMatch(html, /\$[0-9.]+\s*(<[^>]*>)?\s*(per hour|\/ ?h\b)/i);
  assert.doesNotMatch(html, /hourlyRate|salary|compensation/i);
  // The operator's own row carries hours and never a currency amount.
  const row = html.slice(html.indexOf('>op-1<'), html.indexOf('>op-1<') + 400);
  assert.doesNotMatch(row, /\$/);
});

test('the allocated amount per token leads with input and output, and counts what reported none', () => {
  const fixture = makeFixtureRepo();
  const period = '2026-09';
  const pull = openPullRequest(fixture, 'r1', [
    [
      trailered('feat(r): rate', {
        Session: 's-r1',
        Change: 'c-r1',
      }),
      {
        'src/r.ts': 'v1',
        [`.telemetry/subscriptions/${period}/plan-r.json`]: subscriptionJson(
          'plan-r',
          period,
          100,
        ),
        // Two sessions take a share; one of them reported no tokens at all.
        [`.telemetry/sessions/${period}/s-r1.json`]: sessionJson('s-r1', {
          billingKind: 'subscription',
          subscriptionId: 'plan-r',
          costUsd: 0,
          agentRunSeconds: 1800,
          inputTokens: 400_000,
          outputTokens: 600_000,
          cachedTokens: 100_000_000,
        }),
        [`.telemetry/sessions/${period}/s-r2.json`]: sessionJson('s-r2', {
          billingKind: 'subscription',
          subscriptionId: 'plan-r',
          costUsd: 0,
          agentRunSeconds: 1800,
          figuresMissing: true,
        }),
      },
    ],
  ]);
  mergeSquash(fixture, pull, 'feat(r): rate', 'Session: s-r1\nSession: s-r2', {
    hours: 24,
  });

  const { repo } = build(registryFor(fixture.dir));
  const rate = repo.signals.allocation.currencies.USD.rate;

  // The whole 100 is allocated across the two sessions, and the denominator is the million tokens the one
  // session that reported any actually reported.
  assert.equal(rate.amount, 100);
  assert.equal(rate.inputOutputTokens, 1_000_000);
  assert.equal(rate.perMillionInputOutput, 100);

  // Cache reads are reported, and never folded into the headline denominator: doing so would read $1.00.
  assert.equal(rate.cachedTokens, 100_000_000);
  assert.equal(rate.perMillionCached, 1);

  // The session that reported nothing is counted rather than silently shrinking the denominator.
  assert.equal(rate.sessions, 2);
  assert.equal(rate.withoutFigures, 1);
});

test('velocity counts points per week and excludes changes that recorded none', () => {
  const fixture = makeFixtureRepo();
  const withPoints = openPullRequest(fixture, 'v1', [
    [
      trailered('feat(v): pointed', {
        Session: 'none',
        Change: 'c-v1',
        'Story-Points': '5',
      }),
      { 'src/v1.ts': 'a' },
    ],
  ]);
  mergeSquash(fixture, withPoints, 'feat(v): pointed', 'Story-Points: 5', {
    hours: 24,
  });
  const without = openPullRequest(fixture, 'v2', [
    [
      trailered('feat(v): unpointed', { Session: 'none', Change: 'c-v2' }),
      { 'src/v2.ts': 'b' },
    ],
  ]);
  mergeSquash(fixture, without, 'feat(v): unpointed', '', { hours: 24 });

  const { repo } = build(registryFor(fixture.dir));
  const velocity = repo.signals.velocity;

  assert.equal(velocity.storyPoints, 5, 'only the pointed change contributes');
  assert.ok(
    velocity.excludedWithoutPoints >= 1,
    'the unpointed change is counted as excluded',
  );
  assert.ok(velocity.weeks >= 1);
  assert.equal(
    velocity.pointsPerWeek,
    Math.round((5 / velocity.weeks) * 100) / 100,
  );
  // Never keyed to a person: the read carries no operator dimension at all.
  assert.equal(
    Object.prototype.hasOwnProperty.call(velocity, 'byOperator'),
    false,
  );
});

test('coverage separates an agent session, a declared human-only change, and an undeclared one', () => {
  const fixture = makeFixtureRepo();

  // A change with an agent session.
  const agent = openPullRequest(fixture, 'cov-a', [
    [
      trailered('feat(cov): agent', { Session: 's-cov', Change: 'c-cov-a' }),
      {
        'src/a.ts': 'a',
        '.telemetry/sessions/2026-09/s-cov.json': sessionJson('s-cov'),
      },
    ],
  ]);
  mergeSquash(fixture, agent, 'feat(cov): agent', 'Session: s-cov', {
    hours: 24,
  });

  // A change an operator declared human-only: the trailer is a claim, not a default.
  const human = openPullRequest(fixture, 'cov-h', [
    [
      trailered('docs(cov): by hand', { Session: 'none', Change: 'c-cov-h' }),
      { 'docs/h.md': 'h' },
    ],
  ]);
  mergeSquash(fixture, human, 'docs(cov): by hand', 'Session: none', {
    hours: 24,
  });

  // A change committed with no active session and no declaration: no Session: trailer at all.
  const unknown = openPullRequest(fixture, 'cov-u', [
    [
      trailered('chore(cov): unknown', { Change: 'c-cov-u' }),
      { 'src/u.ts': 'u' },
    ],
  ]);
  mergeSquash(fixture, unknown, 'chore(cov): unknown', '', { hours: 24 });

  const { repo } = build(registryFor(fixture.dir));
  const coverage = repo.signals.coverage;

  assert.equal(coverage.agent, 1, 'the agent-session change is counted once');
  assert.equal(coverage.humanOnly, 1, 'only the declared change is human-only');
  assert.ok(
    coverage.undeclared >= 1,
    'the change with no trailer reads undeclared, not human-only',
  );
  assert.equal(
    coverage.agent + coverage.humanOnly + coverage.undeclared <= coverage.total,
    true,
  );
});

test('work mix, flow efficiency, iterations, and check compliance read from what is already recorded', () => {
  const fixture = makeFixtureRepo();
  const mix = [
    ['feat(a): a feature', 'c-mix-1', 's-mix-1'],
    ['fix(b): a fix', 'c-mix-2', 's-mix-2'],
    ['chore(c): a chore', 'c-mix-3', null],
    ['not a conventional subject', 'c-mix-4', null],
  ] as const;
  mix.forEach(([subject, change, session], index) => {
    const files: Record<string, string> = {
      [`src/mix-${index}.ts`]: String(index),
    };
    const trailers: Record<string, string> = { Change: change };
    if (session) {
      trailers.Session = session;
      files[`.telemetry/sessions/2026-09/${session}.json`] = sessionJson(
        session,
        {
          agentRunSeconds: 1800,
        },
      );
    } else {
      trailers.Session = 'none';
    }
    const pull = openPullRequest(fixture, `mix-${index}`, [
      [trailered(subject, trailers), files],
    ]);
    mergeSquash(
      fixture,
      pull,
      subject,
      session ? `Session: ${session}` : 'Session: none',
      { hours: 24 },
    );
  });

  const { repo } = build(registryFor(fixture.dir));
  const signals = repo.signals;

  // Work mix: every change lands in a type, and a subject that does not parse is `other` rather than lost.
  const types = Object.values(signals.workMix.weekly).flatMap((week) =>
    Object.keys(week),
  );
  for (const type of ['feat', 'fix', 'chore', 'other']) {
    assert.ok(types.includes(type), `${type} appears in the work mix`);
  }

  // Flow efficiency: the two changes with sessions can be measured; the two without are excluded by reason.
  assert.equal(signals.flowEfficiency.count, 2);
  assert.equal(signals.flowEfficiency.excluded['no-sessions'], 2);

  // Iterations: one distribution per question, over every change.
  assert.ok(signals.iterations.sessionsPerChange.count >= 4);
  assert.ok(signals.iterations.commitsPerChange.count >= 4);

  // Check compliance: the share matters more than the rate, so both are reported.
  assert.equal(signals.checkCompliance.recorded, 2);
  assert.ok(signals.checkCompliance.recordedShare !== null);
  assert.equal(signals.checkCompliance.passRate, 1);

  // Cost per merged change counts the changes it could not measure rather than averaging over them.
  assert.ok(signals.spend.perMergedChange.excluded >= 2);
});

test('the rework ignore list drops lockfile pairs and says how many', () => {
  const fixture = makeFixtureRepo();
  // Two changes sharing only a lockfile: churn nobody chose, not work done twice.
  for (const index of [0, 1]) {
    const pull = openPullRequest(fixture, `lock-${index}`, [
      [
        trailered(`chore(deps): bump ${index}`, {
          Session: 'none',
          Change: `c-lock-${index}`,
        }),
        { 'package-lock.json': `{"v":${index}}` },
      ],
    ]);
    mergeSquash(fixture, pull, `chore(deps): bump ${index}`, 'Session: none', {
      hours: 2,
    });
  }

  const ignored = build(registryFor(fixture.dir)).repo.signals.rework;
  assert.equal(
    ignored.pairs.length,
    0,
    'a pair sharing only an ignored file is not a pair',
  );
  assert.ok(ignored.ignored >= 1, 'and the read says how many it removed');
  assert.ok(ignored.ignore.includes('**/package-lock.json'));

  // An entry naming its own list replaces the default, so the same pair counts again.
  const counted = parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        { name: 'counted', url: fixture.dir, rework: { ignore: [] } },
      ],
    }),
  ).registry;
  const state = stateRoot();
  syncAll(state, counted);
  const projection = buildProjection(state, counted);
  assert.ok(
    projection.repositories.counted.signals!.rework.pairs.length >= 1,
    'an empty ignore list counts the pair',
  );
});

test('every configuration gap kind is reported with its own remedy', () => {
  // Unit-level, because three of the four kinds need a closed period and a fixture's commits are all now.
  const plans = {
    path: '.telemetry/subscriptions/plans.json',
    valid: true,
    errors: [],
    plans: [
      {
        planId: 'plan-declared',
        provider: 'anthropic',
        currency: 'USD',
        intervals: [{ from: '2026-05', unit: 100, seats: 1 }],
      },
    ],
  };
  const records = [
    {
      path: '.telemetry/subscriptions/2026-06/plan-stray.json',
      producer: 'operator' as const,
      trust: 'reported' as const,
      valid: true,
      errors: [],
      file: {
        schemaVersion: 1,
        planId: 'plan-stray',
        period: '2026-06',
        amount: 10,
        currency: 'USD',
        overageAmount: 0,
      },
    },
  ];
  const gaps = configurationGaps(
    plans,
    records,
    [
      {
        planId: 'plan-ghost',
        period: '2026-06',
        path: '.telemetry/sessions/2026-06/s-1.json',
      },
    ],
    ['2026-04', '2026-06'],
  );
  const byKind = Object.fromEntries(gaps.map((gap) => [gap.kind, gap]));

  // A declared plan with no record for a closed period its intervals cover.
  assert.equal(byKind['missing-record'].subject, 'plan-declared');
  assert.match(byKind['missing-record'].remedy, /subscription close 2026-06/);

  // A closed period before the plan's earliest interval is uncovered, not missing.
  assert.equal(byKind['uncovered-period'].period, '2026-04');
  assert.match(byKind['uncovered-period'].remedy, /add an interval/);

  // A record for a plan no declaration covers.
  assert.equal(byKind['undeclared-plan'].subject, 'plan-stray');

  // A session naming a plan with no record is named rather than only counted.
  assert.equal(byKind['unknown-subscription'].subject, 'plan-ghost');
  assert.deepEqual(byKind['unknown-subscription'].cites, [
    '.telemetry/sessions/2026-06/s-1.json',
  ]);
});

test('configuration gaps name each kind and the command that closes it', () => {
  const fixture = makeFixtureRepo();
  const period = '2026-01';
  const pull = openPullRequest(fixture, 'gap', [
    [
      trailered('feat(gap): work', { Session: 's-gap', Change: 'c-gap' }),
      {
        'src/gap.ts': 'v1',
        // A plan declared but never closed for this period, and a session naming a plan with no record.
        '.telemetry/subscriptions/plans.json': JSON.stringify({
          schemaVersion: 1,
          plans: [
            {
              planId: 'plan-declared',
              provider: 'anthropic',
              currency: 'USD',
              intervals: [{ from: '2020-01', unit: 100, seats: 1 }],
            },
          ],
        }),
        [`.telemetry/sessions/${period}/s-gap.json`]: sessionJson('s-gap', {
          billingKind: 'subscription',
          subscriptionId: 'plan-unknown',
          costUsd: 0,
          endedAt: `${period}-15T10:00:00Z`,
          startedAt: `${period}-15T09:00:00Z`,
        }),
      },
    ],
  ]);
  mergeSquash(fixture, pull, 'feat(gap): work', 'Session: s-gap', {
    hours: 24,
  });

  const { repo } = build(registryFor(fixture.dir));
  const gaps = repo.configurationGaps;
  const kinds = gaps.map((gap) => gap.kind);

  assert.ok(
    kinds.includes('unknown-subscription'),
    'a session naming a plan with no record is named, not only counted',
  );
  // Every gap names the command that closes it: the page reports and never repairs.
  for (const gap of gaps) {
    assert.ok(gap.remedy.length > 0, `${gap.kind} names its remedy`);
    assert.ok(gap.cites.length > 0, `${gap.kind} cites what it read`);
  }
  const unknown = gaps.find((gap) => gap.kind === 'unknown-subscription')!;
  assert.equal(unknown.subject, 'plan-unknown');

  // The gaps are configuration, so they are reported where the operator is and never on the published page.
  const projection = build(registryFor(fixture.dir)).projection;
  const published = renderLedgerHtml(projection);
  assert.doesNotMatch(published, /Subscription configuration/);
  assert.doesNotMatch(published, /plan-unknown/);
  assert.doesNotMatch(published, /<script/i);
  assert.doesNotMatch(published, /<form/i);

  const local = renderConfigurationPage(
    Object.values(projection.repositories),
    linksFor(Object.values(projection.repositories)[0]),
    '{}',
  );
  assert.match(local, /Subscription configuration/);
  assert.match(local, /plan-unknown/);
});

test('two providers report metered rates separately and share no denominator', () => {
  const fixture = makeFixtureRepo();
  const pull = openPullRequest(fixture, 'metered', [
    [
      trailered('feat(m): metered work', {
        Session: 's-m1',
        Change: 'c-m',
      }),
      {
        'src/m.ts': 'v1',
        // One provider billing in USD, another in EUR, plus a session reporting a cost and no tokens.
        '.telemetry/sessions/2026-09/s-m1.json': sessionJson('s-m1', {
          provider: 'provider-one',
          billingKind: 'metered',
          costUsd: 2,
          inputTokens: 600_000,
          outputTokens: 400_000,
          cachedTokens: 5_000_000,
        }),
        '.telemetry/sessions/2026-09/s-m2.json': sessionJson('s-m2', {
          provider: 'provider-two',
          billingKind: 'metered',
          costUsd: 0,
          cost: { amount: 8, currency: 'EUR' },
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          cacheReadTokens: 10,
          cacheWriteTokens: 5,
          cachedTokens: 15,
        }),
        '.telemetry/sessions/2026-09/s-m3.json': sessionJson('s-m3', {
          provider: 'provider-one',
          billingKind: 'metered',
          costUsd: 1,
          figuresMissing: true,
        }),
      },
    ],
  ]);
  mergeSquash(
    fixture,
    pull,
    'feat(m): metered work',
    'Session: s-m1\nSession: s-m2\nSession: s-m3',
    { hours: 24 },
  );

  const { repo, projection } = build(registryFor(fixture.dir));
  const rates = repo.signals.meteredRates;
  // One row per provider and currency. The fixture seeds its own metered session, so assert on the pairs
  // this test created rather than the total.
  const keys = rates.map((rate) => `${rate.provider}/${rate.currency}`);
  assert.ok(keys.includes('provider-one/USD'));
  assert.ok(keys.includes('provider-two/EUR'));
  assert.equal(new Set(keys).size, keys.length, 'no pair appears twice');

  const one = rates.find((rate) => rate.provider === 'provider-one')!;
  const two = rates.find((rate) => rate.provider === 'provider-two')!;

  // $3 paid over a million reported tokens. The second session paid $1 and reported no tokens, so it raises
  // the rate rather than being dropped from it — which is why the count is stated beside the figure.
  assert.equal(one.currency, 'USD');
  assert.equal(one.amount, 3, 'both sessions paid');
  assert.equal(one.inputOutputTokens, 1_000_000, 'only one reported tokens');
  assert.equal(one.perMillionInputOutput, 3);
  assert.equal(one.withoutTokens, 1, 'and the read says so');

  // €8 over two million, in its own currency, sharing no denominator with the other provider.
  assert.equal(two.currency, 'EUR');
  assert.equal(two.inputOutputTokens, 2_000_000);
  assert.equal(two.perMillionInputOutput, 4);

  // The record carrying only a combined cache figure is flagged; the one reporting components is not.
  assert.equal(one.cacheComponentsUnknown, true);
  assert.equal(two.cacheComponentsUnknown, false);

  // Reported and allocated never become one figure.
  assert.ok(one.trust.includes('reported'));
  const html = renderLedgerHtml(projection);
  assert.match(html, /Metered spend per token/);
  assert.match(html, /provider-two/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<form/i);
});

test('no source file branches on a provider identifier', () => {
  // Provider is data, by accepted requirement. The moment a read says `if (provider === 'x')` the tool has
  // stopped being provider-neutral, and a provider it has never seen stops flowing through.
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const files = execFileSync('git', ['ls-files', 'packages/*/src/*.ts'], {
    cwd: root,
    encoding: 'utf8',
    env: gitEnvironment(),
  })
    .split('\n')
    .filter(
      (path) =>
        path && !path.endsWith('.test.ts') && !path.endsWith('fixture.ts'),
    );
  assert.ok(files.length > 0, 'the sweep found source files');
  for (const path of files) {
    const text = readFileSync(join(root, path), 'utf8');
    assert.doesNotMatch(
      text,
      /\b(anthropic|openai|claude|gpt-)\b/i,
      `${path} names a provider outside a data field`,
    );
  }
});

test('the published page carries no configuration, and the local surface refuses everything but it', async () => {
  const fixture = makeFixtureRepo();
  const pull = openPullRequest(fixture, 'cfg', [
    [
      trailered('feat(cfg): work', { Session: 'none', Change: 'c-cfg' }),
      {
        'src/cfg.ts': 'v1',
        '.telemetry/subscriptions/plans.json': JSON.stringify({
          schemaVersion: 1,
          plans: [
            {
              planId: 'plan-secret',
              provider: 'anthropic',
              currency: 'USD',
              intervals: [{ from: '2020-01', unit: 100, seats: 1 }],
            },
          ],
        }),
      },
    ],
  ]);
  mergeSquash(fixture, pull, 'feat(cfg): work', 'Session: none', { hours: 24 });
  const { projection } = build(registryFor(fixture.dir));

  // The published artifact carries no configuration panel, no gap, and nothing that writes. Absence is by
  // containment: the published renderer does not import the module that holds this markup.
  const published = renderLedgerHtml(projection);
  assert.doesNotMatch(published, /Subscription configuration/);
  assert.doesNotMatch(published, /plans\.json/);
  assert.doesNotMatch(published, /<script/i);
  assert.doesNotMatch(published, /<form/i);
  assert.doesNotMatch(published, /<textarea/i);
  assert.doesNotMatch(published, /<button/i);

  // The local page carries both, because it is a different artifact served to one operator on loopback.
  const local = renderConfigurationPage(
    Object.values(projection.repositories),
    linksFor(Object.values(projection.repositories)[0]),
    '{"schemaVersion":1,"plans":[]}',
  );
  assert.match(local, /Subscription configuration/);
  assert.match(local, /<form/);
  assert.match(local, /Local only/);

  // A host that is not loopback is refused rather than bound.
  await assert.rejects(
    serveConfiguration({
      root: fixture.dir,
      port: 0,
      host: '0.0.0.0',
      page: () => '',
    }),
    /loopback interface only/,
  );

  // Only configuration is writable, and a path that escapes the working copy is refused even so.
  assert.equal(
    writablePath(fixture.dir, '.telemetry/subscriptions/plans.json') !== null,
    true,
  );
  assert.equal(
    writablePath(
      fixture.dir,
      '.telemetry/subscriptions/2026-09/plan-x.json',
    ) !== null,
    true,
  );
  assert.equal(
    writablePath(fixture.dir, '.telemetry/sessions/2026-09/s-1.json'),
    null,
  );
  assert.equal(writablePath(fixture.dir, '.telemetry/projection.json'), null);
  assert.equal(writablePath(fixture.dir, '../escape.json'), null);
  assert.equal(writablePath(fixture.dir, '/etc/passwd'), null);

  // Writing configuration changes the working copy and never the history.
  const before = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
    cwd: fixture.dir,
    encoding: 'utf8',
    env: gitEnvironment(),
  }).trim();
  const result = applyWrite(fixture.dir, {
    path: '.telemetry/subscriptions/plans.json',
    body: {
      schemaVersion: 1,
      plans: [
        {
          planId: 'plan-new',
          provider: 'anthropic',
          currency: 'USD',
          intervals: [{ from: '2026-01', unit: 10, seats: 1 }],
        },
      ],
    },
  });
  assert.equal(result.ok, true);
  assert.equal(
    execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: fixture.dir,
      encoding: 'utf8',
      env: gitEnvironment(),
    }).trim(),
    before,
    'writing configuration creates no commit',
  );

  // An invalid declaration is refused rather than written.
  const refused = applyWrite(fixture.dir, {
    path: '.telemetry/subscriptions/plans.json',
    body: { schemaVersion: 1, plans: [{ planId: 'x' }] },
  });
  assert.equal(refused.ok, false);
});

test('a projection built over many synthetic changes stays well under a minute', () => {
  const fixture = makeFixtureRepo();
  const count = Number(process.env.DEV_LEDGER_SYNTHETIC_CHANGES ?? '60');
  for (let index = 0; index < count; index += 1) {
    const pull = openPullRequest(
      fixture,
      `syn-${index}`,
      [
        [
          trailered(`feat(syn): change ${index}`, {
            Session: 'none',
            Change: `c-${index}`,
          }),
          { [`syn/${index}.txt`]: String(index) },
        ],
      ],
      { minutes: 10 },
    );
    mergeSquash(fixture, pull, `feat(syn): change ${index}`, '', {
      minutes: 20,
    });
  }
  const started = Date.now();
  const { repo } = build(registryFor(fixture.dir));
  const elapsed = Date.now() - started;
  assert.equal(repo.changes.length, count + 1);
  process.stdout.write(
    `# rebuild over ${count} synthetic changes took ${elapsed}ms\n`,
  );
  assert.ok(elapsed < 120_000);
});

test('commit helper keeps the fixture deterministic', () => {
  const fixture = makeFixtureRepo();
  const hash = commit(fixture, 'chore(repo): deterministic', { 'd.txt': 'd' });
  assert.equal(hash.length, 40);
});

test('child git processes never inherit a parent index or repository', () => {
  process.env.GIT_INDEX_FILE = '/nonexistent/index';
  process.env.GIT_DIR = '/nonexistent/.git';
  try {
    const env = gitEnvironment();
    assert.equal(env.GIT_INDEX_FILE, undefined);
    assert.equal(env.GIT_DIR, undefined);
    const fixture = makeFixtureRepo();
    assert.equal(
      git(fixture.dir, ['rev-parse', '--is-inside-work-tree']).trim(),
      'true',
    );
  } finally {
    delete process.env.GIT_INDEX_FILE;
    delete process.env.GIT_DIR;
  }
});

test('a squash subject inherited from another repository does not mark a newer pull request as merged', () => {
  const fixture = makeFixtureRepo();
  // Upstream history: a squash merge whose subject names pull request 1 of the repository it came from.
  directPush(fixture, 'feat(upstream): inherited change (#1)', {
    'upstream.txt': 'u',
  });
  // This repository's own pull request 1, opened later and still unmerged.
  openPullRequest(
    fixture,
    'mine',
    [
      [
        trailered('feat(mine): new work', {
          Session: 'none',
          Change: 'c-mine',
        }),
        { 'mine.txt': 'm' },
      ],
    ],
    { hours: 48 },
  );
  const { repo } = build(registryFor(fixture.dir));
  assert.deepEqual(
    (repo.unmerged as { number: number }[]).map((entry) => entry.number),
    [1],
    'the inherited subject predates the pull request, so the pull request is still in the queue',
  );
});

test('DORA reads approximate to the release tag and say so', () => {
  const fixture = makeFixtureRepo();
  writeFiles(fixture, {
    'telemetry.config.json': JSON.stringify({
      schemaVersion: 1,
      costAllocation: {
        enabled: true,
        idleCapSeconds: 900,
        operators: [],
        costClasses: ['rd', 'production'],
      },
    }),
  });
  commit(fixture, 'chore(repo): enable cost allocation', {});
  const first = openPullRequest(fixture, 'f1', [
    [
      trailered('feat(f): add', {
        Session: 's-a',
        Change: 'c-f1',
        'Cost-Class': 'production',
      }),
      {
        'src/f.ts': 'v1',
        '.telemetry/sessions/2026-09/s-a.json': sessionJson('s-a', {
          costClass: 'rd',
          costUsd: 1,
          operatorActiveSeconds: 0,
          operatorActiveAlgorithm: 'idle-cap-v1:900',
          operatorId: null,
        }),
        '.telemetry/sessions/2026-09/s-b.json': sessionJson('s-b', {
          costUsd: 2,
          operatorActiveSeconds: 0,
          operatorActiveAlgorithm: 'idle-cap-v1:900',
          operatorId: null,
        }),
      },
    ],
  ]);
  mergeSquash(
    fixture,
    first,
    'feat(f): add',
    'Session: s-a\nSession: s-b\nCost-Class: production',
    { hours: 24 },
  );
  tag(fixture, 'v1.0.0');
  const fix = openPullRequest(
    fixture,
    'f2',
    [
      [
        trailered('fix(f): repair', { Session: 'none', Change: 'c-f2' }),
        { 'src/f.ts': 'v2' },
      ],
    ],
    { hours: 48 },
  );
  mergeSquash(fixture, fix, 'fix(f): repair', '', { hours: 24 });
  commit(
    fixture,
    'chore(repo): bump',
    { 'CHANGELOG.md': 'x' },
    { hours: 24 * 12 },
  );
  tag(fixture, 'v1.1.0');
  const unreleased = openPullRequest(fixture, 'f3', [
    [
      trailered('feat(f): later', { Session: 'none', Change: 'c-f3' }),
      { 'later.txt': 'l' },
    ],
  ]);
  mergeSquash(fixture, unreleased, 'feat(f): later');
  const { repo } = build(registryFor(fixture.dir));
  const dora = repo.signals!.dora;
  assert.equal(dora.deploymentFrequency.releases, 2);
  assert.deepEqual(dora.deploymentFrequency.tags, ['v1.0.0', 'v1.1.0']);
  assert.ok(dora.deploymentFrequency.perWeek! > 0);
  assert.match(
    dora.deploymentFrequency.note,
    /release tags stand in for deployments/,
  );
  assert.equal(
    dora.leadTimeToRelease.excluded.unreleased,
    1,
    'the change after the newest tag is excluded by reason',
  );
  assert.ok(dora.leadTimeToRelease.cites.includes(first.mergedAs!));
  assert.ok(dora.leadTimeToRelease.p50! > 0);
  assert.ok(dora.leadTimeToRelease.mergeToTag.p50! >= 0);
  assert.equal(
    dora.changeFailureRate.escapes,
    0,
    'the fix is inside the newest release, so it is not an escape',
  );
  assert.equal(dora.changeFailureRate.releases, 2);
  const classes = repo.signals!.costClasses;
  assert.equal(classes.rd.costUsd, 1, "the session's own class wins");
  assert.equal(
    classes.production.costUsd,
    2,
    "the change's trailer covers the other session",
  );
  assert.equal(classes.unclassified, undefined);
  assert.ok(repo.signals!.trends.weekly.length >= 2);
  assert.equal(
    repo.signals!.trends.weekly.reduce((sum, week) => sum + week.changes, 0),
    repo.changes.length,
  );
  assert.equal(repo.signals!.coverage.agent, 1);
});

test('an escape after the newest release yields a failure rate and a time to fix', () => {
  const fixture = makeFixtureRepo();
  const released = openPullRequest(fixture, 'r1', [
    [
      trailered('feat(r): ship', { Session: 'none', Change: 'c-r1' }),
      { 'src/r.ts': 'v1' },
    ],
  ]);
  mergeSquash(fixture, released, 'feat(r): ship');
  tag(fixture, 'v2.0.0');
  const fix = openPullRequest(
    fixture,
    'r2',
    [
      [
        trailered('fix(r): repair', { Session: 'none', Change: 'c-r2' }),
        { 'src/r.ts': 'v2' },
      ],
    ],
    { hours: 10 },
  );
  mergeSquash(fixture, fix, 'fix(r): repair', '', { hours: 2 });
  const { repo } = build(registryFor(fixture.dir));
  const dora = repo.signals!.dora;
  assert.equal(dora.changeFailureRate.escapes, 1);
  assert.equal(dora.changeFailureRate.perRelease, 1);
  assert.deepEqual(dora.changeFailureRate.cites, [fix.mergedAs]);
  assert.equal(dora.timeToFix.count, 1);
  assert.equal(
    dora.timeToFix.p50,
    12 * 3600,
    'from the released change merge to the fix merge',
  );
  assert.deepEqual(dora.timeToFix.cites, [
    `${fix.mergedAs}<-${released.mergedAs}`,
  ]);
  assert.match(
    dora.timeToFix.note,
    /restore in production would need a deployment record/,
  );
});

test('subscription spend is allocated by agent run seconds, excluded and counted, and provisional while open', () => {
  const fixture = makeFixtureRepo();
  // The open period is the month of the newest commit the mirror will hold; the closed one is well before.
  const first = openPullRequest(fixture, 'seed', [
    ['feat(seed): seed', { 'seed.txt': 's' }],
  ]);
  mergeSquash(fixture, first, 'feat(seed): seed');
  const openPeriod = git(fixture.dir, ['log', '-1', '--format=%cI'])
    .trim()
    .slice(0, 7);
  const sub = (
    id: string,
    endedAt: string,
    agentRunSeconds: number,
    extra: Record<string, unknown> = {},
  ) =>
    sessionJson(id, {
      billingKind: 'subscription',
      subscriptionId: 'plan-max',
      costUsd: 0,
      endedAt,
      startedAt: endedAt,
      agentRunSeconds,
      ...extra,
    });
  const work = openPullRequest(fixture, 'work', [
    [
      trailered('feat(work): allocated', {
        Spec: 'add-work',
        Session: 's-a',
        Change: 'c-w',
      }),
      {
        'work.txt': 'w',
        '.telemetry/sessions/x/s-a.json': sub(
          's-a',
          `${openPeriod}-02T10:00:00Z`,
          1800,
        ),
        '.telemetry/sessions/x/s-b.json': sub(
          's-b',
          `${openPeriod}-03T10:00:00Z`,
          600,
          {
            figuresMissing: true,
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
          },
        ),
        '.telemetry/sessions/x/s-c.json': sub(
          's-c',
          `${openPeriod}-04T10:00:00Z`,
          0,
        ),
        '.telemetry/sessions/x/s-old.json': sub(
          's-old',
          '2026-01-15T10:00:00Z',
          100,
        ),
        '.telemetry/sessions/x/s-idle.json': sub(
          's-idle',
          '2025-12-15T10:00:00Z',
          0,
        ),
        '.telemetry/sessions/x/s-none.json': sub(
          's-none',
          '2025-11-15T10:00:00Z',
          500,
        ),
        [`.telemetry/subscriptions/${openPeriod}/plan-max.json`]:
          subscriptionJson('plan-max', openPeriod, 240, { overageAmount: 24 }),
        '.telemetry/subscriptions/2026-01/plan-max.json': subscriptionJson(
          'plan-max',
          '2026-01',
          100,
        ),
        '.telemetry/subscriptions/2025-12/plan-max.json': subscriptionJson(
          'plan-max',
          '2025-12',
          50,
        ),
        '.telemetry/subscriptions/2025-10/bad.json':
          '{"schemaVersion":1,"salary":1}',
      },
    ],
  ]);
  mergeSquash(
    fixture,
    work,
    'feat(work): allocated',
    'Spec: add-work\nSession: s-a\nSession: s-b\nSession: s-c\nSession: s-old\nSession: s-idle\nSession: s-none',
  );
  openPullRequest(fixture, 'waiting', [
    [
      trailered('feat(waiting): unmerged', { Session: 's-u', Change: 'c-u' }),
      {
        'u.txt': 'u',
        '.telemetry/sessions/x/s-u.json': sub(
          's-u',
          `${openPeriod}-05T10:00:00Z`,
          600,
        ),
      },
    ],
  ]);
  const built = build(registryFor(fixture.dir));
  const allocation = built.repo.signals!.allocation;
  assert.deepEqual(allocation.trust, ['allocated']);
  assert.equal(allocation.basis, 'agentRunSeconds');
  // 240 over 1800 + 600 + 600 agent seconds: 144, 48, 48; overage 24 the same way.
  assert.deepEqual(
    ['s-a', 's-b', 's-u'].map((id) => [
      allocation.bySession[id].amount,
      allocation.bySession[id].overage,
    ]),
    [
      [144, 14.4],
      [48, 4.8],
      [48, 4.8],
    ],
  );
  assert.equal(
    allocation.bySession['s-c'],
    undefined,
    'no agent seconds, no share',
  );
  assert.equal(
    allocation.bySession['s-none'],
    undefined,
    'no period record, no share',
  );
  const open = allocation.periods.find(
    (period) => period.period === openPeriod,
  )!;
  assert.equal(open.provisional, true);
  assert.equal(open.allocated, 3);
  assert.equal(open.excludedNoAgentSeconds, 1);
  assert.ok(
    open.cites.includes(`.telemetry/subscriptions/${openPeriod}/plan-max.json`),
  );
  const closed = allocation.periods.find(
    (period) => period.period === '2026-01',
  )!;
  assert.equal(closed.provisional, false);
  assert.equal(allocation.bySession['s-old'].amount, 100);
  const idle = allocation.periods.find(
    (period) => period.period === '2025-12',
  )!;
  assert.equal(idle.unallocated, true);
  assert.equal(idle.allocated, 0);
  assert.deepEqual(allocation.excluded, {
    noAgentSeconds: 2,
    noPeriodRecord: 1,
    invalidSession: 0,
    invalidRecord: 1,
  });
  const usd = allocation.currencies.USD;
  assert.equal(usd.total.amount, 340);
  assert.equal(usd.total.overage, 24);
  assert.equal(usd.total.provisional, true);
  assert.equal(usd.bySpec['add-work'].amount, 292);
  assert.equal(usd.perUnmergedPullRequest[String(3)].amount, 48);
  assert.equal(usd.unmergedPullRequests.sessions, 1);
  // A record with missing figures took its share and is still excluded from reported figures.
  assert.equal(built.repo.signals!.spend.excluded.missingFigures, 1);
  assert.ok(
    usd.byChange[work.mergedAs!].cites.includes(
      '.telemetry/sessions/x/s-b.json',
    ),
  );
  assert.equal(built.repo.subscriptions.length, 4);
  const ledger = renderLedger(built.projection);
  assert.match(ledger, /subscription spend \(allocated by agentRunSeconds\)/);
  assert.match(
    ledger,
    /allocated total USD: \$364\.00 over 4 sessions \(provisional\)/,
  );
  // Deterministic: the same records rebuild byte-identically.
  const again = build(registryFor(fixture.dir));
  assert.equal(
    canonicalJson(built.projection),
    canonicalJson(again.projection),
  );
});

test("a merge commit takes its work mix type from its branch commits, not from git's subject", () => {
  const fixture = makeFixtureRepo();
  const feature = openPullRequest(fixture, 'feature', [
    [
      trailered('feat(a): first', { Session: 'none', Change: 'c-f' }),
      { 'a.txt': '1' },
    ],
    [
      trailered('feat(a): second', { Session: 'none', Change: 'c-f' }),
      { 'a.txt': '2' },
    ],
    [
      trailered('fix(a): typo', { Session: 'none', Change: 'c-f' }),
      { 'a.txt': '3' },
    ],
    [
      trailered('chore(telemetry): record session s-x', {
        Session: 'none',
        Change: 'c-f',
      }),
      { 'b.txt': 'b' },
    ],
  ]);
  mergeCommit(fixture, feature);
  const untyped = openPullRequest(fixture, 'untyped', [
    ['wrote some things', { 'c.txt': 'c' }],
  ]);
  mergeCommit(fixture, untyped);
  const { repo } = build(registryFor(fixture.dir));
  const mix = Object.values(repo.signals!.workMix.weekly);
  const count = (type: string) =>
    mix.reduce((sum, week) => sum + (week[type]?.changes ?? 0), 0);
  assert.equal(
    count('feat'),
    1,
    'two feat commits outvote one fix; the record commit does not vote',
  );
  assert.equal(count('fix'), 0);
  const otherCites = mix.flatMap((week) => week.other?.cites ?? []);
  assert.ok(
    otherCites.includes(untyped.mergedAs!),
    'the untyped branch reads other',
  );
  assert.ok(!otherCites.includes(feature.mergedAs!));
  assert.match(repo.signals!.workMix.note, /branch commits/);
});

test('measuredFrom excludes what predates the instrumentation, and a declared closed pull request leaves the queue', () => {
  const fixture = makeFixtureRepo();
  const early = openPullRequest(fixture, 'early', [
    ['feat(early): before', { 'e.txt': 'e' }],
  ]);
  mergeSquash(fixture, early, 'feat(early): before');
  const cut = git(fixture.dir, ['log', '-1', '--format=%cI']).trim();
  const late = openPullRequest(fixture, 'late', [
    [
      trailered('feat(late): after', { Session: 'none', Change: 'c-l' }),
      { 'l.txt': 'l' },
    ],
  ]);
  mergeSquash(fixture, late, 'feat(late): after', 'Session: none');
  const waiting = openPullRequest(fixture, 'waiting', [
    ['feat(w): waiting', { 'w.txt': 'w' }],
  ]);
  const closed = openPullRequest(fixture, 'closed', [
    ['feat(c): closed', { 'c.txt': 'c' }],
  ]);
  const registry = parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        {
          name: 'fixture',
          url: fixture.dir,
          measuredFrom: new Date(Date.parse(cut) + 1000).toISOString(),
          closedPullRequests: [closed.number],
        },
      ],
    }),
  ).registry;
  const { repo } = build(registry);
  const signals = repo.signals!;
  assert.equal(
    signals.boundary.preInstrumentation,
    2,
    'the initial commit and the early change',
  );
  assert.equal(signals.coverage.total, 1);
  assert.equal(signals.coverage.humanOnly, 1);
  assert.deepEqual(signals.boundary.declaredClosed, [closed.number]);
  assert.deepEqual(
    signals.queue.pullRequests.map((entry) => entry.number),
    [waiting.number],
  );
  assert.equal(
    repo.changes.length,
    3,
    'the projection still records every change',
  );
});

test('flow efficiency counts only active time inside the cycle window, and spec lead time starts at the proposal', () => {
  const fixture = makeFixtureRepo();
  const seed = openPullRequest(fixture, 'seed', [
    ['feat(seed): seed', { 'seed.txt': 's' }],
  ]);
  mergeSquash(fixture, seed, 'feat(seed): seed');
  const proposal = openPullRequest(fixture, 'draft', [
    [
      'docs(openspec): draft add-x',
      { 'openspec/changes/add-x/proposal.md': '# Add X' },
    ],
  ]);
  mergeSquash(fixture, proposal, 'docs(openspec): draft add-x');
  const work = openPullRequest(fixture, 'work', [
    [
      trailered('feat(x): first', {
        Spec: 'add-x',
        Session: 's-w',
        Change: 'c-w',
      }),
      { 'x.txt': '1' },
    ],
    [
      trailered('feat(x): second', {
        Spec: 'add-x',
        Session: 's-w',
        Change: 'c-w',
      }),
      { 'x.txt': '2' },
    ],
  ]);
  const firstAuthored = git(fixture.dir, [
    'log',
    '-1',
    '--format=%aI',
    work.commits[0],
  ]).trim();
  const start = new Date(Date.parse(firstAuthored) - 3_600_000).toISOString();
  const end = new Date(Date.parse(firstAuthored) + 3_600_000).toISOString();
  // The record travels in the work branch, as the hook writes it.
  git(fixture.dir, ['switch', '--quiet', 'work']);
  work.commits.push(
    commit(
      fixture,
      trailered('chore(telemetry): record session s-w', {
        Spec: 'add-x',
        Session: 's-w',
        Change: 'c-w',
      }),
      {
        '.telemetry/sessions/x/s-w.json': sessionJson('s-w', {
          startedAt: start,
          endedAt: end,
          agentRunSeconds: 1200,
          spec: 'add-x',
        }),
      },
      { minutes: 1 },
    ),
  );
  git(fixture.dir, ['update-ref', `refs/pull/${work.number}/head`, 'HEAD']);
  git(fixture.dir, ['switch', '--quiet', 'main']);
  mergeSquash(fixture, work, 'feat(x): work', 'Spec: add-x\nSession: s-w');
  const archive = openPullRequest(fixture, 'archive', [
    [
      'docs(openspec): archive add-x',
      { 'openspec/changes/archive/2026-09-18-add-x/proposal.md': '# Add X' },
    ],
  ]);
  mergeSquash(fixture, archive, 'docs(openspec): archive add-x');
  const { repo } = build(registryFor(fixture.dir));
  const signals = repo.signals!;
  const efficiency = signals.flowEfficiency;
  assert.ok(efficiency.count >= 1, 'the work change is measured');
  // 1,200 active seconds spread over a two-hour window with one hour inside the cycle: about 600 outside.
  assert.ok(
    efficiency.outsideSeconds >= 400 && efficiency.outsideSeconds <= 800,
    `outside ${efficiency.outsideSeconds}`,
  );
  assert.ok((efficiency.max ?? 2) <= 1);
  assert.match(efficiency.note, /outside the window/);
  const lead = signals.specLeadTime;
  assert.ok(lead.cites.includes('add-x'));
  // From the proposal's first commit, not the trailer's: the fixture advances hours between commits.
  assert.ok((lead.max ?? 0) >= 3 * 3600, `lead ${lead.max}`);
});

test('velocity is the relative complexity of tasks completed per week, unweighted tasks counting one', () => {
  const fixture = makeFixtureRepo();
  const draft = openPullRequest(fixture, 'draft', [
    [
      'docs(openspec): draft add-t',
      {
        'openspec/changes/add-t/tasks.md': [
          '# Tasks',
          '- [ ] 1.1 ~3 build the thing',
          '- [ ] 1.2 ~5 test the thing',
          '- [ ] 1.3 document it',
          '',
        ].join('\n'),
      },
    ],
  ]);
  mergeSquash(fixture, draft, 'docs(openspec): draft add-t');
  const work = openPullRequest(fixture, 'work', [
    [
      'feat(t): build and test',
      {
        'openspec/changes/add-t/tasks.md': [
          '# Tasks',
          '- [x] 1.1 ~3 build the thing',
          '- [x] 1.2 ~5 test the thing',
          '- [ ] 1.3 document it',
          '',
        ].join('\n'),
      },
    ],
  ]);
  mergeSquash(fixture, work, 'feat(t): build and test');
  const archive = openPullRequest(fixture, 'archive', [
    [
      'docs(openspec): archive add-t',
      {
        'openspec/changes/archive/2026-09-18-add-t/tasks.md': [
          '# Tasks',
          '- [x] 1.1 ~3 build the thing',
          '- [x] 1.2 ~5 test the thing',
          '- [x] 1.3 document it',
          '',
        ].join('\n'),
      },
    ],
  ]);
  mergeSquash(fixture, archive, 'docs(openspec): archive add-t');
  const built = build(registryFor(fixture.dir));
  const repo = built.repo;
  const velocity = repo.signals!.velocity;
  assert.equal(velocity.tasks, 3);
  assert.equal(
    velocity.complexity,
    9,
    '3 + 5, and the unweighted task counts one',
  );
  assert.equal(velocity.unweightedTasks, 1);
  assert.ok(
    velocity.complexityPerWeek !== null && velocity.complexityPerWeek > 0,
  );
  const workChange = repo.changes.find((c) => c.id === work.mergedAs) as
    { tasks: unknown[] } | undefined;
  assert.equal(
    (workChange?.tasks ?? []).length,
    2,
    'the work change ticked two tasks',
  );
  const archiveChange = repo.changes.find((c) => c.id === archive.mergedAs) as
    { tasks: { id: string }[] } | undefined;
  assert.deepEqual(
    archiveChange?.tasks.map((t) => t.id),
    ['1.3'],
    'the archive move re-ticks nothing',
  );
  assert.match(renderLedgerHtml(built.projection), /complexity per week/);
});

test('unit economics carry an allocated figure per task complexity, and unidentified hours stay visible', () => {
  const fixture = makeFixtureRepo();
  // The configuration is read at each change's base, so it lands before the change that needs it.
  const seed = openPullRequest(fixture, 'seed', [
    [
      'feat(seed): seed',
      {
        'seed.txt': 's',
        'telemetry.config.json': JSON.stringify({
          schemaVersion: 1,
          costAllocation: {
            enabled: true,
            idleCapSeconds: 900,
            operators: ['op-1'],
            costClasses: ['rd'],
          },
        }),
      },
    ],
  ]);
  mergeSquash(fixture, seed, 'feat(seed): seed');
  const period = git(fixture.dir, ['log', '-1', '--format=%cI'])
    .trim()
    .slice(0, 7);
  const work = openPullRequest(fixture, 'work', [
    [
      trailered('feat(w): weighted work', {
        Spec: 'add-w',
        Session: 's-w',
        Change: 'c-w',
      }),
      {
        'openspec/changes/add-w/tasks.md':
          '# Tasks\n- [x] 1.1 ~3 build\n- [x] 1.2 ~5 test\n',
        '.telemetry/sessions/x/s-w.json': sessionJson('s-w', {
          billingKind: 'subscription',
          subscriptionId: 'plan-max',
          costUsd: 0,
          startedAt: `${period}-02T09:00:00Z`,
          endedAt: `${period}-02T10:00:00Z`,
          agentRunSeconds: 1200,
          operatorActiveSeconds: 1800,
          operatorActiveAlgorithm: 'prompt-attribution-v1:900',
          operatorId: null,
          spec: 'add-w',
        }),
        [`.telemetry/subscriptions/${period}/plan-max.json`]: subscriptionJson(
          'plan-max',
          period,
          16,
        ),
      },
    ],
  ]);
  mergeSquash(
    fixture,
    work,
    'feat(w): weighted work',
    'Spec: add-w\nSession: s-w',
  );
  const built = build(registryFor(fixture.dir));
  const signals = built.repo.signals!;
  const unit = signals.spend.perEffortUnit.taskComplexity;
  assert.equal(unit.allocatedPerUnit, 2, '$16 over complexity 8');
  assert.equal(unit.costPerUnit, 0, 'reported stays zero, never summed');
  assert.equal(unit.currency, 'USD');
  assert.equal(signals.spend.perEffortUnit.tasks.allocatedPerUnit, 8);
  assert.equal(signals.spend.perMergedChange.allocated, 16);
  const humans = signals.operators.humans;
  assert.ok(
    humans['(no operator identifier)'],
    'hours without an identifier stay on the page',
  );
  assert.equal(humans['(no operator identifier)'].hours, 0.5);
  const html = renderLedgerHtml(built.projection);
  assert.match(html, /\(provisional\)/);
  assert.doesNotMatch(html, /\$16\.00 ~/);
  assert.match(html, /reported spend/);
  assert.match(html, /allocated per unit/);
});

test('a spec declaration classifies sessions that declare nothing, and the class carries allocated spend and hours', () => {
  const fixture = makeFixtureRepo();
  const seed = openPullRequest(fixture, 'seed', [
    [
      'feat(seed): seed',
      {
        'seed.txt': 's',
        'telemetry.config.json': JSON.stringify({
          schemaVersion: 1,
          costAllocation: {
            enabled: true,
            idleCapSeconds: 900,
            operators: ['op-1'],
            costClasses: ['rd', 'production'],
          },
        }),
        '.telemetry/classes.json': JSON.stringify({
          schemaVersion: 1,
          classes: { 'add-r': 'rd' },
        }),
      },
    ],
  ]);
  mergeSquash(fixture, seed, 'feat(seed): seed');
  const period = git(fixture.dir, ['log', '-1', '--format=%cI'])
    .trim()
    .slice(0, 7);
  const sub = (id: string, extra: Record<string, unknown>) =>
    sessionJson(id, {
      billingKind: 'subscription',
      subscriptionId: 'plan-max',
      costUsd: 0,
      startedAt: `${period}-02T09:00:00Z`,
      endedAt: `${period}-02T10:00:00Z`,
      agentRunSeconds: 600,
      operatorActiveSeconds: 3600,
      operatorActiveAlgorithm: 'prompt-attribution-v1:900',
      operatorId: 'op-1',
      ...extra,
    });
  const work = openPullRequest(fixture, 'work', [
    [
      trailered('feat(r): research', {
        Spec: 'add-r',
        Session: 's-a',
        Change: 'c-r',
      }),
      {
        'r.txt': 'r',
        '.telemetry/sessions/x/s-a.json': sub('s-a', { spec: 'add-r' }),
        '.telemetry/sessions/x/s-b.json': sub('s-b', {
          spec: 'add-r',
          costClass: 'production',
        }),
        [`.telemetry/subscriptions/${period}/plan-max.json`]: subscriptionJson(
          'plan-max',
          period,
          20,
        ),
      },
    ],
  ]);
  mergeSquash(
    fixture,
    work,
    'feat(r): research',
    'Spec: add-r\nSession: s-a\nSession: s-b',
  );
  const built = build(registryFor(fixture.dir));
  const classes = built.repo.signals!.costClasses;
  assert.equal(classes.rd.sessions, 1, 'declared by the spec');
  assert.equal(classes.rd.sources.spec, 1);
  assert.equal(classes.production.sessions, 1, 'the session class wins');
  assert.equal(classes.production.sources.session, 1);
  assert.equal(
    classes.rd.allocated,
    10,
    'half of the $20 period by agent seconds',
  );
  assert.equal(classes.rd.hours, 1);
  assert.equal(classes.unclassified, undefined);
  assert.deepEqual(built.repo.classes.classes, { 'add-r': 'rd' });
  assert.ok(
    (built.repo.signals!.flowEfficiency.outsideBySpec['add-r'] ?? 0) >= 0,
  );
  const html = renderLedgerHtml(built.projection);
  assert.match(html, /1 spec/);
  assert.match(html, /declared by/);
});

test('hours are reported by operator, spec, and month, with a committed timesheet confirming beside the measurement', () => {
  const fixture = makeFixtureRepo();
  const seed = openPullRequest(fixture, 'seed', [
    [
      'feat(seed): seed',
      {
        'seed.txt': 's',
        'telemetry.config.json': JSON.stringify({
          schemaVersion: 1,
          costAllocation: {
            enabled: true,
            idleCapSeconds: 900,
            operators: ['op-1'],
            costClasses: ['rd'],
          },
        }),
      },
    ],
  ]);
  mergeSquash(fixture, seed, 'feat(seed): seed');
  const work = openPullRequest(fixture, 'work', [
    [
      trailered('feat(h): hours', {
        Spec: 'add-h',
        Session: 's-h',
        Change: 'c-h',
      }),
      {
        'h.txt': 'h',
        '.telemetry/sessions/2026-09/s-h.json': sessionJson('s-h', {
          startedAt: '2026-09-03T09:00:00Z',
          endedAt: '2026-09-03T11:00:00Z',
          operatorActiveSeconds: 7200,
          operatorActiveAlgorithm: 'prompt-attribution-v1:900',
          operatorId: 'op-1',
        }),
        '.telemetry/timesheets/2026-09/op-1.json': JSON.stringify({
          schemaVersion: 1,
          operatorId: 'op-1',
          period: '2026-09',
          bySpec: { 'add-h': 1.5 },
          measuredBySpec: { 'add-h': 2 },
        }),
      },
    ],
  ]);
  mergeSquash(fixture, work, 'feat(h): hours', 'Spec: add-h\nSession: s-h');
  const built = build(registryFor(fixture.dir));
  const hours = built.repo.signals!.hours;
  assert.equal(hours.byOperator['op-1'].measured, 2);
  assert.deepEqual(hours.byOperator['op-1'].bySpec, { 'add-h': 2 });
  assert.equal(hours.byOperator['op-1'].byMonth['2026-09'].confirmed, 1.5);
  assert.equal(
    hours.byOperator['op-1'].byMonth['2026-09'].timesheet,
    '.telemetry/timesheets/2026-09/op-1.json',
  );
  assert.equal(hours.confirmed, 1.5);
  assert.equal(built.repo.timesheets.length, 1);
  const html = renderLedgerHtml(built.projection);
  assert.match(html, /<h3>Hours<\/h3>/);
  assert.match(html, /1\.5 h/);
});

test('the registry rollup sums a spec across repositories, and a period statement exports as rows', () => {
  const config = JSON.stringify({
    schemaVersion: 1,
    costAllocation: {
      enabled: true,
      idleCapSeconds: 900,
      operators: ['op-1'],
      costClasses: ['rd'],
    },
  });
  const repos = ['one', 'two'].map((label) => {
    const fixture = makeFixtureRepo();
    const seed = openPullRequest(fixture, 'seed', [
      [
        'feat(seed): seed',
        { 'seed.txt': 's', 'telemetry.config.json': config },
      ],
    ]);
    mergeSquash(fixture, seed, 'feat(seed): seed');
    const period = git(fixture.dir, ['log', '-1', '--format=%cI'])
      .trim()
      .slice(0, 7);
    const work = openPullRequest(fixture, 'work', [
      [
        trailered(`feat(${label}): shared spec`, {
          Spec: 'add-shared',
          Session: `s-${label}`,
          Change: `c-${label}`,
        }),
        {
          [`${label}.txt`]: label,
          [`.telemetry/sessions/x/s-${label}.json`]: sessionJson(`s-${label}`, {
            billingKind: 'subscription',
            subscriptionId: 'plan-max',
            costUsd: 0,
            startedAt: `${period}-02T09:00:00Z`,
            endedAt: `${period}-02T10:00:00Z`,
            agentRunSeconds: 600,
            operatorActiveSeconds: 1800,
            operatorActiveAlgorithm: 'prompt-attribution-v1:900',
            operatorId: 'op-1',
            spec: 'add-shared',
          }),
          [`.telemetry/subscriptions/${period}/plan-max.json`]:
            subscriptionJson('plan-max', period, 10),
        },
      ],
    ]);
    mergeSquash(
      fixture,
      work,
      `feat(${label}): shared spec`,
      `Spec: add-shared\nSession: s-${label}`,
    );
    return { fixture, period };
  });
  const registry = parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: repos.map((r, i) => ({
        name: ['one', 'two'][i],
        url: r.fixture.dir,
      })),
    }),
  ).registry;
  const built = build(registry);
  const rollup = built.projection.registry;
  assert.deepEqual(rollup.repositories, ['one', 'two']);
  assert.equal(
    rollup.bySpec['add-shared'].allocated,
    20,
    '$10 from each repository',
  );
  assert.deepEqual(rollup.bySpec['add-shared'].repositories, ['one', 'two']);
  assert.equal(rollup.bySpec['add-shared'].hours, 1);
  assert.equal(rollup.hours['op-1'].measured, 1);
  const html = renderLedgerHtml(built.projection);
  assert.match(html, /All repositories/);
  assert.match(html, /Spend by spec, across the registry/);
  const rows = buildStatement(built.projection, repos[0].period);
  const allocationRows = rows.filter(
    (row) => row.kind === 'allocation' && row.metric === 'amount',
  );
  assert.equal(allocationRows.length, 2);
  assert.ok(
    rows.some(
      (row) => row.kind === 'hours' && row.key === 'op-1' && row.value === 0.5,
    ),
  );
  const csv = statementCsv(rows);
  assert.match(
    csv,
    /^period,repository,kind,key,metric,value,unit,trust,scope\n/,
  );
  assert.match(
    csv,
    new RegExp(
      `${repos[0].period},one,allocation,plan-max,amount,10,USD,allocated,period`,
    ),
  );
  assert.equal(
    buildStatement(built.projection, '1999-01').filter(
      (row) => row.scope === 'period',
    ).length,
    0,
  );
});

test('the declared default classifies work no session, trailer, or spec declares, and a spec declaration wins over it', () => {
  const fixture = makeFixtureRepo();
  const seed = openPullRequest(fixture, 'seed', [
    [
      'feat(seed): seed',
      {
        'seed.txt': 's',
        'telemetry.config.json': JSON.stringify({
          schemaVersion: 1,
          costAllocation: {
            enabled: true,
            idleCapSeconds: 900,
            operators: ['op-1'],
            costClasses: ['rd', 'production'],
          },
        }),
        '.telemetry/classes.json': JSON.stringify({
          schemaVersion: 1,
          default: 'rd',
          classes: { 'add-p': 'production' },
        }),
      },
    ],
  ]);
  mergeSquash(fixture, seed, 'feat(seed): seed');
  const record = (id: string, spec?: string) =>
    sessionJson(id, {
      operatorActiveSeconds: 1800,
      operatorActiveAlgorithm: 'prompt-attribution-v1:900',
      operatorId: 'op-1',
      ...(spec ? { spec } : {}),
    });
  const work = openPullRequest(fixture, 'work', [
    [
      trailered('feat(w): two kinds of work', {
        Session: 's-p',
        Change: 'c-w',
      }),
      {
        'w.txt': 'w',
        '.telemetry/sessions/x/s-p.json': record('s-p', 'add-p'),
        '.telemetry/sessions/x/s-n.json': record('s-n'),
      },
    ],
  ]);
  mergeSquash(
    fixture,
    work,
    'feat(w): two kinds of work',
    'Session: s-p\nSession: s-n',
  );
  const built = build(registryFor(fixture.dir));
  const classes = built.repo.signals!.costClasses;
  assert.equal(
    classes.production.sources.spec,
    1,
    'the spec declaration wins over the default',
  );
  assert.equal(
    classes.rd.sources.default,
    1,
    'the record citing no spec takes the default',
  );
  assert.equal(classes.unclassified, undefined);
  assert.equal(built.repo.classes.default, 'rd');
});

test('work a tag ships is shipped, work overwritten before the tag or closed unmerged is discarded, and the rest is pending', () => {
  const fixture = makeFixtureRepo();
  const seed = openPullRequest(fixture, 'seed', [
    [
      'feat(seed): seed',
      {
        'seed.txt': 's',
        'telemetry.config.json': JSON.stringify({
          schemaVersion: 1,
          costAllocation: {
            enabled: true,
            idleCapSeconds: 900,
            operators: ['op-1'],
            costClasses: ['rd', 'production'],
          },
        }),
        '.telemetry/classes.json': JSON.stringify({
          schemaVersion: 1,
          classes: { 'add-x': 'rd' },
          release: { shipped: 'production', discarded: 'rd' },
        }),
      },
    ],
  ]);
  mergeSquash(fixture, seed, 'feat(seed): seed');
  const record = (id: string, spec?: string) =>
    sessionJson(id, spec ? { spec } : {});
  const merged = (
    branch: string,
    subject: string,
    session: string,
    change: string,
    files: Record<string, string>,
  ) => {
    const pull = openPullRequest(fixture, branch, [
      [
        trailered(subject, { Session: session, Change: change }),
        {
          ...files,
          [`.telemetry/sessions/x/${session}.json`]: record(
            session,
            branch === 'declared' ? 'add-x' : undefined,
          ),
        },
      ],
    ]);
    mergeSquash(fixture, pull, subject, `Session: ${session}`);
  };
  merged('shipped', 'feat(a): shipped', 's-shipped', 'c-a', {
    'a.txt': 'one\ntwo\n',
  });
  merged('tried', 'feat(b): tried', 's-tried', 'c-b', {
    'b.txt': 'first attempt\nstill first\n',
  });
  merged('replaced', 'feat(b): replaced', 's-replaced', 'c-r', {
    'b.txt': 'second attempt\n',
  });
  merged('declared', 'feat(x): declared', 's-declared', 'c-x', {
    'x.txt': 'x\n',
  });
  tag(fixture, 'v1.0.0');
  merged('later', 'feat(d): merged, not tagged', 's-later', 'c-d', {
    'd.txt': 'd\n',
  });
  openPullRequest(fixture, 'open', [
    [
      trailered('feat(e): still open', { Session: 's-open', Change: 'c-e' }),
      { 'e.txt': 'e', '.telemetry/sessions/x/s-open.json': record('s-open') },
    ],
  ]);
  const closed = openPullRequest(fixture, 'closed', [
    [
      trailered('feat(f): closed', { Session: 's-closed', Change: 'c-f' }),
      {
        'f.txt': 'f',
        '.telemetry/sessions/x/s-closed.json': record('s-closed'),
      },
    ],
  ]);
  const registry = parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        {
          name: 'fixture',
          url: fixture.dir,
          releaseTagPattern: 'v*',
          closedPullRequests: [closed.number],
        },
      ],
    }),
  ).registry;
  const { repo } = build(registry);
  const shipping = repo.signals!.shipping;
  const subjects = (ids: string[]) =>
    ids
      .map((id) => String(change(repo, id).subject).replace(/ \(#\d+\)$/, ''))
      .sort();
  assert.deepEqual(
    subjects(shipping.states.discarded.changes),
    ['feat(b): tried'],
    'a tag reaches the first attempt, but none of its lines are in the tag',
  );
  assert.deepEqual(subjects(shipping.states.pending.changes), [
    'feat(d): merged, not tagged',
  ]);
  assert.ok(
    subjects(shipping.states.shipped.changes).includes('feat(b): replaced'),
  );
  assert.deepEqual(shipping.states.discarded.pullRequests, [closed.number]);
  assert.equal(shipping.states.pending.pullRequests.length, 1);
  const release = shipping.releases[0];
  assert.equal(release.tag, 'v1.0.0');
  assert.equal(release.discarded, 1);
  assert.ok(
    release.surviving < release.added,
    'the overwritten attempt counts as added and not surviving',
  );
  const classes = repo.signals!.costClasses;
  assert.deepEqual(classes.production.sources, { shipped: 2 });
  assert.deepEqual(
    classes.rd.sources,
    { discarded: 2, spec: 1 },
    'the overwritten attempt, the closed pull request, and a spec declaration that wins over the rule',
  );
  assert.deepEqual(
    classes.pending.sources,
    { pending: 2 },
    'the untagged merge and the open pull request wait for the next tag',
  );
  assert.equal(classes.unclassified, undefined);
  assert.deepEqual(repo.classes.release, {
    shipped: 'production',
    discarded: 'rd',
  });
});
