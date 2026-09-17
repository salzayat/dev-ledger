import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml, renderBoardHtml } from './board-html.ts';
import {
  makeFixtureRepo,
  mergeSquash,
  openPullRequest,
  sessionJson,
  tag,
  trailered,
} from './fixture.ts';
import { buildProjection } from './projection.ts';
import { parseRegistry, webUrl } from './registry.ts';
import { syncAll } from './sync.ts';
import { mkdtempSync } from 'node:fs';
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
  openPullRequest(fixture, 'open', [
    [
      trailered('feat(open): waiting', { Session: 'none', Change: 'c-o' }),
      { 'open.txt': 'o' },
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
  const state = mkdtempSync(join(tmpdir(), 'dev-ledger-board-'));
  syncAll(state, registry);
  return buildProjection(state, registry);
}

test('the empty projection renders an explicit empty state', () => {
  const html = renderBoardHtml(null);
  assert.match(html, /The Board is empty/);
  assert.match(html, /<!doctype html>/);
});

test('the page loads no resource: no script, no src, no stylesheet, both color schemes, narrow layout', () => {
  const html = renderBoardHtml(fixtureProjection());
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
  const html = renderBoardHtml(fixtureProjection());
  assert.doesNotMatch(html, /<a class="ref"/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /feat\(one\)/);
});

test('a cited commit names its change and links to the platform', () => {
  const projection = fixtureProjection();
  projection.repositories.fixture.webUrl = 'https://github.com/acme/fixture';
  const html = renderBoardHtml(projection);
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
  assert.equal(webUrl('git@gitlab.com:acme/repo.git'), null);
});

test('the projection records the derived web URL, never the registry path', () => {
  const projection = fixtureProjection();
  assert.equal(projection.repositories.fixture.webUrl, null);
  assert.equal(projection.repositories.gone.webUrl, null);
  assert.equal(projection.schemaVersion, 2);
});

test('every panel carries trust classes, excluded counts, and citations', () => {
  const html = renderBoardHtml(fixtureProjection());
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
  assert.match(html, /Unreachable:/);
  assert.match(html, /Measured as of/);
});

test('text from the repository is escaped and no person dimension appears', () => {
  const html = renderBoardHtml(fixtureProjection());
  assert.doesNotMatch(html, /<first>/);
  const linked = renderBoardHtml(
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
  assert.doesNotMatch(html, /operator|author/i);
});
