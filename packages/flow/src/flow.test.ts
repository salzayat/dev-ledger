/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { renderBoard } from './board.ts';
import { renderBoardHtml } from './board-html.ts';
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
  assert.match(renderBoard(projection), /1 unreachable \(gone\)/);
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

test('the board renders an empty state and never a person dimension', () => {
  assert.match(renderBoard(null), /The Board is empty/);
  const fixture = makeFixtureRepo();
  const { projection } = build(registryFor(fixture.dir));
  const text = renderBoard(projection);
  assert.match(text, /no changes on the default branch yet|cycle time/);
  // The operator dimension is now a read, so the board may name an operator. What it must never do is
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
  const html = renderBoardHtml(projection);
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
  const board = renderBoard(built.projection);
  assert.match(board, /subscription spend \(allocated by agentRunSeconds\)/);
  assert.match(
    board,
    /allocated total USD: \$364\.00 over 4 sessions \(provisional\)/,
  );
  // Deterministic: the same records rebuild byte-identically.
  const again = build(registryFor(fixture.dir));
  assert.equal(
    canonicalJson(built.projection),
    canonicalJson(again.projection),
  );
});
