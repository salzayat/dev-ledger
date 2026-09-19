import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml, renderLedgerHtml } from './ledger-html.ts';
import {
  makeFixtureRepo,
  mergeSquash,
  openPullRequest,
  sessionJson,
  subscriptionJson,
  tag,
  trailered,
} from './fixture.ts';
import { buildProjection } from './projection.ts';
import { parseRegistry, webUrl } from './registry.ts';
import { syncAll } from './sync.ts';
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fixtureProjection() {
  const fixture = makeFixtureRepo();
  const pull = openPullRequest(fixture, 'one', [
    [
      trailered('feat(one): <first> & "quoted"', {
        Spec: 'add-one',
        Session: 's-1',
        Change: 'c-1',
      }),
      {
        'one.txt': '1',
        '.telemetry/sessions/2026-09/s-1.json': sessionJson('s-1', {
          spec: 'add-one',
        }),
      },
    ],
  ]);
  mergeSquash(
    fixture,
    pull,
    'feat(one): <first> & "quoted"',
    'Spec: add-one\nSession: s-1\nStory-Points: 2',
  );
  tag(fixture, 'v0.1.0');
  // A merged change that declares no session at all: spend must read `undeclared`, never zero.
  const bare = openPullRequest(fixture, 'bare', [
    ['feat(bare): no trailers at all', { 'bare.txt': 'b' }],
  ]);
  mergeSquash(fixture, bare, 'feat(bare): no trailers at all');
  // One unmerged pull request with a record carrying figures and one carrying none.
  openPullRequest(fixture, 'open', [
    [
      trailered('feat(open): waiting', { Session: 'none', Change: 'c-o' }),
      {
        'open.txt': 'o',
        '.telemetry/sessions/2026-09/s-open.json': sessionJson('s-open'),
        '.telemetry/sessions/2026-09/s-open-blind.json': sessionJson(
          's-open-blind',
          {
            figuresMissing: true,
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            costUsd: 0,
          },
        ),
      },
    ],
  ]);
  // An unmerged pull request whose only record carries no figures at all.
  openPullRequest(fixture, 'blind', [
    [
      trailered('feat(blind): unmeasured', {
        Session: 's-blind',
        Change: 'c-b',
      }),
      {
        'blind.txt': 'b',
        '.telemetry/sessions/2026-09/s-blind.json': sessionJson('s-blind', {
          figuresMissing: true,
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          costUsd: 0,
        }),
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
          thresholds: { waitTimeP50Seconds: 1 },
        },
        { name: 'gone', url: join(tmpdir(), 'dev-ledger-missing') },
      ],
    }),
  ).registry;
  const state = mkdtempSync(join(tmpdir(), 'dev-ledger-render-'));
  syncAll(state, registry);
  return buildProjection(state, registry);
}

test('the empty projection renders an explicit empty state', () => {
  const html = renderLedgerHtml(null);
  assert.match(html, /The Ledger is empty/);
  assert.match(html, /<!doctype html>/);
});

test('the page loads no resource: no script, no src, no stylesheet, both color schemes, narrow layout', () => {
  const html = renderLedgerHtml(fixtureProjection());
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<link/i);
  assert.doesNotMatch(html, /\ssrc=/i);
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)![1];
  assert.doesNotMatch(style, /url\(/i);
  assert.doesNotMatch(style, /@import/i);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(html, /max-width: 720px/);
  assert.match(html, /name="viewport"/);
});

test('a repository with no web URL renders its citations unlinked', () => {
  const html = renderLedgerHtml(fixtureProjection());
  assert.doesNotMatch(html, /<a class="ref"/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /feat\(one\)/);
});

test('a cited commit names its change and links to the platform', () => {
  const projection = fixtureProjection();
  projection.repositories.fixture.webUrl = 'https://github.com/acme/fixture';
  const html = renderLedgerHtml(projection);
  const change = projection.repositories.fixture.changes[0] as {
    id: string;
    subject: string;
  };
  assert.match(
    html,
    new RegExp(
      `<a class="ref" href="https://github.com/acme/fixture/commit/${change.id}"><code>${change.id.slice(0, 10)}</code></a>`,
    ),
  );
  assert.match(html, /<span class="cite-title">feat\(one\): /);
  assert.match(html, /href="https:\/\/github.com\/acme\/fixture\/pull\/1"/);
  assert.match(
    html,
    /href="https:\/\/github.com\/acme\/fixture\/blob\/main\/\.telemetry\/sessions\/[^"]+\.json"/,
  );
  for (const link of html.matchAll(/href="(http[^"]+)"/g)) {
    assert.ok(
      link[1] === 'https://github.com/acme/fixture' ||
        link[1].startsWith('https://github.com/acme/fixture/'),
      `unexpected link target ${link[1]}`,
    );
  }
});

test('a web URL is derived from a GitHub remote and from nothing else', () => {
  assert.equal(
    webUrl('git@github.com:salzayat/dev-ledger.git'),
    'https://github.com/salzayat/dev-ledger',
  );
  assert.equal(
    webUrl('ssh://git@github.com/salzayat/dev-ledger.git'),
    'https://github.com/salzayat/dev-ledger',
  );
  assert.equal(
    webUrl('https://github.com/salzayat/dev-ledger'),
    'https://github.com/salzayat/dev-ledger',
  );
  assert.equal(
    webUrl('https://github.example.com/acme/repo.git'),
    'https://github.example.com/acme/repo',
  );
  assert.equal(webUrl('/tmp/dev-ledger-fixture'), null);
  // An SSH host alias is how a machine picks a key; it is not a host the derivation can read.
  assert.equal(webUrl('git@github.com-work:salzayat/dev-ledger.git'), null);
  assert.equal(webUrl('git@gitlab.com:acme/repo.git'), null);
});

test('a registry entry may name its web URL explicitly, and a bad one is an error', () => {
  const parsed = parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: [
        {
          name: 'aliased',
          url: 'git@github.com-work:salzayat/dev-ledger.git',
          webUrl: 'https://github.com/salzayat/dev-ledger/',
        },
        { name: 'plain', url: 'git@github.com:salzayat/dev-ledger.git' },
        { name: 'bad', url: '/tmp/repo', webUrl: 'file:///tmp/repo' },
      ],
    }),
  );
  assert.equal(
    parsed.registry.repositories[0].webUrl,
    'https://github.com/salzayat/dev-ledger',
  );
  assert.equal(parsed.registry.repositories[1].webUrl, null);
  assert.match(
    parsed.errors.join('\n'),
    /repositories\[2\]\.webUrl must be an https URL/,
  );
});

test('the projection records the derived web URL, never the registry path', () => {
  const projection = fixtureProjection();
  assert.equal(projection.repositories.fixture.webUrl, null);
  assert.equal(projection.repositories.gone.webUrl, null);
  assert.equal(projection.schemaVersion, 6);
});

test('every panel carries trust classes, excluded counts, and citations', () => {
  const html = renderLedgerHtml(fixtureProjection());
  for (const title of [
    'Cycle time',
    'Wait time',
    'Unmerged queue',
    'Batch size',
    'Merge frequency',
    'Rework',
    'Escapes',
    'Local checks',
    'Spend',
    'Recent changes',
    'Population',
    'Spend over time',
    'Spend by cost class',
    'Deployment frequency',
    'Lead time to release',
    'Change failure rate',
    'Time to fix',
    'Spend by spec',
    'Spend by provider',
    'Spend by model',
    'Cost per unit of effort',
  ]) {
    assert.match(html, new RegExp(`<h3>${title}</h3>`), title);
  }
  assert.match(html, /badge-observed/);
  assert.match(html, /badge-reported/);
  assert.match(html, /excluded: /);
  assert.match(html, /<details class="cites">/);
  assert.match(html, /add-one/);
  assert.match(html, /s-1\.json/);
  assert.match(html, /Signal: wait-time-p50/);
  assert.match(html, /releases \/ week/);
  assert.match(html, /release tags stand in for deployments/);
  assert.match(html, /lead time to release/);
  assert.match(html, /escapes \/ release/);
  assert.match(html, /time to fix/);
  assert.match(html, /Unreachable:/);
  assert.match(html, /Measured as of/);
});

test('text from the repository is escaped and no identifier resolves to a person', () => {
  const html = renderLedgerHtml(fixtureProjection());
  assert.doesNotMatch(html, /<first>/);
  const linked = renderLedgerHtml(
    (() => {
      const projection = fixtureProjection();
      projection.repositories.fixture.webUrl =
        'https://github.com/acme/fixture';
      return projection;
    })(),
  );
  assert.doesNotMatch(linked, /<first>/);
  assert.match(linked, /&lt;first&gt;/);
  assert.equal(
    escapeHtml('<a href="x">&\''),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;',
  );
  // The operator is a dimension now. The boundary that replaced the old prohibition is narrower and
  // stricter about the thing that actually matters: nothing on the page resolves to a person.
  assert.doesNotMatch(html, /author/i);
  assert.doesNotMatch(html, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(html, /hourlyRate|salary|compensation/i);
});

test('spend on an unmerged pull request excludes a record with no figures rather than zeroing it', () => {
  const spend = fixtureProjection().repositories.fixture.signals!.spend;
  assert.equal(spend.unmergedPullRequests.sessions, 1);
  assert.equal(spend.unmergedPullRequests.costUsd, 0.5);
  assert.equal(spend.unmergedPullRequests.excluded.missingFigures, 2);
  assert.equal(spend.unmergedPullRequests.excluded.invalidSession, 0);
});

test('spend is attributable to one unmerged pull request, citing every record', () => {
  const spend = fixtureProjection().repositories.fixture.signals!.spend;
  const mixed = Object.values(spend.perUnmergedPullRequest).find(
    (entry) => entry.cites.length === 2,
  )!;
  assert.equal(mixed.spend.sessions, 1);
  assert.equal(mixed.spend.costUsd, 0.5);
  assert.equal(mixed.missingFigures, 1);
  assert.equal(mixed.invalidSession, 0);
  assert.equal(
    mixed.cites.filter((path) => path.endsWith('s-open-blind.json')).length,
    1,
  );
  const blind = Object.values(spend.perUnmergedPullRequest).find(
    (entry) => entry.cites.length === 1,
  )!;
  assert.equal(blind.spend.sessions, 0);
  assert.equal(blind.spend.costUsd, 0);
  assert.equal(blind.missingFigures, 1);
});

test('the queue and changes tables show spend, or say why there is none', () => {
  const projection = fixtureProjection();
  const html = renderLedgerHtml(projection);
  const rows = html.match(/<tr>(?:(?!<\/tr>)[\s\S])*<\/tr>/g) ?? [];
  const queueRow = rows.find(
    (row) => row.includes('#3') && row.includes('$0.50'),
  );
  assert.ok(queueRow, 'the mixed pull request shows its cost');
  const blindRow = rows.find(
    (row) => row.includes('#4') && row.includes('figures missing'),
  );
  assert.ok(blindRow, 'a pull request with no figures says so');
  assert.doesNotMatch(blindRow!, /\$0\.00/);
  // Scoped to the recent-changes row: the work-mix table cites the same change and renders first.
  const undeclaredRow = rows.find(
    (row) =>
      row.includes('no trailers at all') && row.includes('class="subject"'),
  );
  assert.ok(undeclaredRow, 'the undeclared change has a row');
  assert.match(undeclaredRow!, /undeclared/);
  assert.doesNotMatch(undeclaredRow!, /\$0\.00/);
  // Scoped to the recent-changes row rather than the first row naming the change: the effort-unit table
  // cites the same change and now renders in the spend tab, ahead of this one in document order.
  const declaredRow = rows.find(
    (row) => row.includes('feat(one)') && row.includes('class="subject"'),
  );
  assert.ok(declaredRow, 'the declared change has a recent-changes row');
  assert.match(declaredRow!, /\$0\.50/);
});

test('views need no script and no form, come in two levels, and separate DORA from flow', () => {
  const html = renderLedgerHtml(fixtureProjection());

  // The page may not execute anything and may not carry a control that submits: the published artifact is
  // static, and the configuration surface it must never become lives elsewhere.
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<input/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /<select/i);

  // Every sub-view is a fragment on this page, so a view is a URL and a link to one opens it.
  const tabIds = [
    ...html.matchAll(/<section class="tab[^"]*" id="([^"]+)"/g),
  ].map((match) => match[1]);
  const views = [
    'metrics-flow',
    'metrics-dora',
    'metrics-throughput',
    'economics-spend',
    'economics-effort',
    'records-changes',
    'records-queue',
    'records-notes',
  ];
  assert.equal(tabIds.length, views.length, 'eight sub-views per repository');
  for (const name of views) {
    assert.ok(
      tabIds.some((id) => id.endsWith(`-${name}`)),
      `${name} has its own sub-view`,
    );
    assert.match(html, new RegExp(`<a class="sub" href="#[^"]*-${name}"`));
  }
  // Three parents, each pointing at its first sub-view, and a sub-row per parent.
  for (const [parent, first] of [
    ['Metrics', 'metrics-flow'],
    ['Economics', 'economics-spend'],
    ['Records', 'records-changes'],
  ]) {
    assert.match(
      html,
      new RegExp(`<a class="top" href="#[^"]*-${first}">${parent}</a>`),
    );
    assert.match(
      html,
      new RegExp(`class="row sub sub-${parent.toLowerCase()}"`),
    );
  }
  // The parent marks itself current from its children's targets, and the sub-row shows on the same rule.
  assert.match(
    html,
    /body:has\(#fixture-heading-economics-spend:target, #fixture-heading-economics-effort:target\) nav\.tabs a\.top\[href="#fixture-heading-economics-spend"\]/,
  );
  assert.match(
    html,
    /body:has\(#fixture-heading-economics-spend:target, #fixture-heading-economics-effort:target\) nav\.tabs \.row\.sub-economics/,
  );

  // DORA and flow are different sub-views, not two groups in one scroll.
  const section = (name: string) => {
    const open = html.indexOf(
      `id="${tabIds.find((id) => id.endsWith(`-${name}`))}"`,
    );
    const rest = html.slice(open);
    // Panels are sections too, so slice to the next tab rather than to the next closing tag.
    const next = rest.indexOf('<section class="tab', 1);
    return next === -1 ? rest : rest.slice(0, next);
  };
  assert.match(section('metrics-dora'), /Lead time to release/);
  assert.doesNotMatch(section('metrics-dora'), /Wait time/);
  assert.match(section('metrics-flow'), /Wait time/);
  assert.doesNotMatch(section('metrics-flow'), /Lead time to release/);
  assert.match(section('metrics-throughput'), /Merge frequency/);
  assert.match(section('economics-effort'), /Cost per unit of effort/);
  assert.match(section('records-queue'), /Unmerged queue/);

  // One view renders without a fragment, chosen by CSS rather than by a script, and is last in the document.
  assert.match(
    html,
    /class="tab tab--default" id="fixture-heading-metrics-flow"/,
  );
  assert.match(html, /\.tabbed > \.tab:target ~ \.tab--default/);
  assert.equal(tabIds[tabIds.length - 1], 'fixture-heading-metrics-flow');
});

test('the headline composes figures the page already shows and links each to its view', () => {
  const projection = fixtureProjection();
  const html = renderLedgerHtml(projection);
  const signals = projection.repositories.fixture.signals!;
  const lede = /<p class="lede">([\s\S]*?)<\/p>/.exec(html)![1];
  // The typical wait in the sentence is the wait panel's value, linked to the flow view.
  const wait = new RegExp(
    `<a href="#fixture-heading-metrics-flow"><strong>${signals.waitTime.p50! < 60 ? Math.round(signals.waitTime.p50!) + ' s' : ''}`,
  );
  assert.match(lede, wait);
  assert.match(lede, /finished work waits/);
  assert.match(
    lede,
    /Reported spend is <a href="#fixture-heading-economics-spend"><strong>\$/,
  );
  // Five figures, each a link to a view, each with a trust class, none a currency zero.
  const kpis = /<div class="kpis">([\s\S]*?)<\/div>\n<nav/.exec(html)![1];
  const cards =
    kpis.match(/<a class="kpi" href="#fixture-heading-[a-z-]+">/g) ?? [];
  assert.equal(cards.length, 5);
  assert.equal((kpis.match(/class="badge badge-/g) ?? []).length, 5);
  assert.doesNotMatch(kpis, /\$0\.00/);
  assert.match(kpis, /<svg class="spark"/);
  // Provenance sits in the footer, not above the first headline.
  const footer = html.indexOf('<footer>');
  assert.ok(html.indexOf('Projection schema') > footer);
  assert.ok(
    html.indexOf('projection schema', 0) === -1 ||
      html.indexOf('projection schema') > footer,
  );
});

test('in every panel the figure precedes the folded methodology, and trailing citations follow it', () => {
  const html = renderLedgerHtml(fixtureProjection());
  const panels =
    html.match(/<section class="panel[^"]*">[\s\S]*?<\/section>/g) ?? [];
  assert.ok(panels.length > 10);
  const wait = panels.find((panel) => panel.includes('<h3>Wait time</h3>'))!;
  const figureAt = wait.indexOf('<p class="figure">');
  const howAt = wait.indexOf(
    '<details class="how"><summary>How it\'s measured</summary>',
  );
  const citesAt = wait.lastIndexOf('<details class="cites">');
  assert.ok(figureAt > 0 && howAt > figureAt && citesAt > howAt);
  // The methodology note and the help text are inside the fold, closed by default.
  assert.match(wait, /<details class="how">(?!\s*open)/);
  assert.match(wait.slice(howAt), /excluded: /);
  assert.match(wait.slice(howAt), /Typical is the median/);
  // The trust classes sit beside the title, not in the prose.
  assert.match(
    wait,
    /<div class="head"><h3>Wait time<\/h3><span class="trust"><span class="badge badge-observed">/,
  );
  // A citation inside a table row stays in its row.
  const spec = panels.find((panel) =>
    panel.includes('<h3>Spend by spec</h3>'),
  )!;
  assert.match(spec, /<td><details class="cites">/);
});

test('allocated subscription spend renders beside reported spend, with its class and provisional mark', () => {
  const fixture = makeFixtureRepo();
  const seed = openPullRequest(fixture, 'seed', [
    ['feat(seed): seed', { 'seed.txt': 's' }],
  ]);
  mergeSquash(fixture, seed, 'feat(seed): seed');
  const period = execFileSync('git', ['log', '-1', '--format=%cI'], {
    cwd: fixture.dir,
    encoding: 'utf8',
  })
    .trim()
    .slice(0, 7);
  const pull = openPullRequest(fixture, 'sub', [
    [
      trailered('feat(sub): on a plan', {
        Spec: 'add-sub',
        Session: 's-sub',
        Change: 'c-s',
      }),
      {
        'sub.txt': 's',
        '.telemetry/sessions/x/s-sub.json': sessionJson('s-sub', {
          billingKind: 'subscription',
          subscriptionId: 'plan-max',
          costUsd: 0,
          startedAt: `${period}-02T09:00:00Z`,
          endedAt: `${period}-02T10:00:00Z`,
          agentRunSeconds: 1200,
        }),
        [`.telemetry/subscriptions/${period}/plan-max.json`]: subscriptionJson(
          'plan-max',
          period,
          200,
        ),
      },
    ],
  ]);
  mergeSquash(
    fixture,
    pull,
    'feat(sub): on a plan',
    'Spec: add-sub\nSession: s-sub',
  );
  const registry = parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'fixture', url: fixture.dir }],
    }),
  ).registry;
  const state = mkdtempSync(join(tmpdir(), 'dev-ledger-render-sub-'));
  syncAll(state, registry);
  const html = renderLedgerHtml(buildProjection(state, registry));
  assert.match(html, /<h3>Subscription spend<\/h3>/);
  assert.match(html, /badge-allocated/);
  assert.match(
    html,
    /\$200\.00 allocated <span class="dim">provisional<\/span>/,
  );
  assert.match(html, /<td><code>plan-max<\/code><\/td>/);
  assert.match(html, /allocated across the sessions of each recorded period/);
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /url\(/);
});

test('operator notes render on the records tab, dated and cited', () => {
  const fixture = makeFixtureRepo();
  const pull = openPullRequest(fixture, 'noted', [
    [
      'feat(noted): with a note',
      {
        'n.txt': 'n',
        '.telemetry/notes/template-history.json': JSON.stringify({
          schemaVersion: 1,
          noteId: 'template-history',
          figure: 'coverage',
          text: 'The undeclared changes are template history from before the hooks existed.',
          at: '2026-09-18T00:00:00Z',
        }),
      },
    ],
  ]);
  mergeSquash(fixture, pull, 'feat(noted): with a note');
  const registry = parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'fixture', url: fixture.dir }],
    }),
  ).registry;
  const state = mkdtempSync(join(tmpdir(), 'dev-ledger-notes-'));
  syncAll(state, registry);
  const projection = buildProjection(state, registry);
  assert.equal(projection.repositories.fixture.notes.length, 1);
  const html = renderLedgerHtml(projection);
  assert.match(html, /<h3>Notes<\/h3>/);
  assert.match(html, /template history from before the hooks existed/);
  assert.match(html, /\.telemetry\/notes\/template-history\.json/);
});

test('a subscription-only repository shows no currency zero anywhere on the page', () => {
  const fixture = makeFixtureRepo();
  const seed = openPullRequest(fixture, 'seed', [
    ['feat(seed): seed', { 'seed.txt': 's' }],
  ]);
  mergeSquash(fixture, seed, 'feat(seed): seed');
  const period = execFileSync('git', ['log', '-1', '--format=%cI'], {
    cwd: fixture.dir,
    encoding: 'utf8',
  })
    .trim()
    .slice(0, 7);
  const pull = openPullRequest(fixture, 'sub', [
    [
      trailered('feat(sub): on a plan', {
        Spec: 'add-sub',
        Session: 's-sub',
        Change: 'c-s',
      }),
      {
        'sub.txt': 's',
        '.telemetry/sessions/x/s-sub.json': sessionJson('s-sub', {
          billingKind: 'subscription',
          subscriptionId: 'plan-max',
          costUsd: 0,
          startedAt: `${period}-02T09:00:00Z`,
          endedAt: `${period}-02T10:00:00Z`,
          agentRunSeconds: 1200,
        }),
        [`.telemetry/subscriptions/${period}/plan-max.json`]: subscriptionJson(
          'plan-max',
          period,
          200,
        ),
      },
    ],
  ]);
  mergeSquash(
    fixture,
    pull,
    'feat(sub): on a plan',
    'Spec: add-sub\nSession: s-sub',
  );
  const registry = parseRegistry(
    JSON.stringify({
      schemaVersion: 1,
      repositories: [{ name: 'fixture', url: fixture.dir }],
    }),
  ).registry;
  const state = mkdtempSync(join(tmpdir(), 'dev-ledger-nozero-'));
  syncAll(state, registry);
  const projection = buildProjection(state, registry);
  const html = renderLedgerHtml(projection);
  assert.doesNotMatch(html, /\$0\.00\b/);
  assert.doesNotMatch(html, /0\.0 h confirmed/);
  assert.match(html, /none reported/);
  assert.match(html, /allocated across 1 week/);
  assert.match(
    html,
    /none confirmed by a timesheet yet|No operator hours recorded yet/,
  );
  assert.equal(
    projection.repositories.fixture.signals!.trends.weekly[0].allocated,
    200,
  );
});
