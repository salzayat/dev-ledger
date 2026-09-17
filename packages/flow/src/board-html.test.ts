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
import { parseRegistry } from './registry.ts';
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

test('the page is self-contained: no script, no external resource, both color schemes, narrow layout', () => {
  const html = renderBoardHtml(fixtureProjection());
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /<link/i);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(html, /max-width: 720px/);
  assert.match(html, /name="viewport"/);
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
  assert.equal(
    escapeHtml('<a href="x">&\''),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;',
  );
  assert.doesNotMatch(html, /operator|author/i);
});
