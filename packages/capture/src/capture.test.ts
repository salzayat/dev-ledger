import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONFIG, parseConfig } from './config.ts';
import {
  buildSessionFile,
  computeOperatorActiveSeconds,
  sessionFilePath,
  validateSessionFile,
} from './session.ts';
import { formatTrailers, parseTrailers, validateMessage } from './trailers.ts';
import { sessionSummary } from './cli.ts';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const allocationConfig = parseConfig(
  JSON.stringify({
    costAllocation: {
      enabled: true,
      idleCapSeconds: 900,
      operators: ['op-1'],
      costClasses: ['rd', 'production'],
    },
  }),
).config;

const baseSession = {
  schemaVersion: 1,
  sessionId: 's-1',
  provider: 'provider-a',
  model: 'model-x',
  inputTokens: 10,
  outputTokens: 5,
  cachedTokens: 0,
  costUsd: 0.12,
  figuresSource: 'harness',
  startedAt: '2026-09-21T10:00:00Z',
  endedAt: '2026-09-21T11:00:00Z',
  wallClockSeconds: 3600,
  agentRunSeconds: 1200,
  billingKind: 'metered',
  branch: 'add-thing',
  commits: ['abc'],
  localCheck: { outcome: 'passed', command: 'npm run check' },
};

test('a valid session file passes', () => {
  assert.deepEqual(validateSessionFile(baseSession, DEFAULT_CONFIG), []);
});

test('a negative token count names the field', () => {
  const errors = validateSessionFile(
    { ...baseSession, inputTokens: -1 },
    DEFAULT_CONFIG,
  );
  assert.ok(errors.some((error) => error.startsWith('inputTokens')));
});

test('a name, email, or rate field is rejected', () => {
  for (const key of ['operatorName', 'email', 'hourlyRate']) {
    const errors = validateSessionFile(
      { ...baseSession, [key]: 'x' },
      DEFAULT_CONFIG,
    );
    assert.ok(
      errors.some((error) => error.startsWith(key)),
      key,
    );
  }
});

test('a subscription session carries zero cost and a notional figure apart', () => {
  const file = buildSessionFile(
    {
      ...baseSession,
      billingKind: 'subscription',
      subscriptionId: 'plan-1',
      costUsd: 3.1,
      notionalCostUsd: 3.1,
    },
    DEFAULT_CONFIG,
  );
  assert.equal(file.costUsd, 0);
  assert.equal(file.notionalCostUsd, 3.1);
  assert.deepEqual(validateSessionFile(file, DEFAULT_CONFIG), []);
  const errors = validateSessionFile({ ...file, costUsd: 3.1 }, DEFAULT_CONFIG);
  assert.ok(errors.some((error) => error.startsWith('costUsd must be 0')));
});

test('operator fields are absent when cost allocation is off', () => {
  const file = buildSessionFile(
    {
      ...baseSession,
      operatorEvents: ['2026-09-21T10:00:00Z'],
      operatorId: 'op-1',
    },
    DEFAULT_CONFIG,
  );
  assert.equal(file.operatorActiveSeconds, undefined);
  assert.equal(file.operatorId, undefined);
  const errors = validateSessionFile(
    { ...baseSession, operatorId: 'op-1' },
    DEFAULT_CONFIG,
  );
  assert.ok(errors.some((error) => error.includes('must be absent')));
});

test('the idle cap counts short gaps and caps the long one', () => {
  const events = [
    '2026-09-21T10:00:00Z',
    '2026-09-21T10:02:00Z',
    '2026-09-21T10:05:00Z',
    '2026-09-21T10:55:00Z',
  ];
  assert.equal(computeOperatorActiveSeconds(events, 900), 120 + 180 + 900);
  const file = buildSessionFile(
    { ...baseSession, operatorEvents: events, operatorId: 'op-1' },
    allocationConfig,
  );
  assert.equal(file.operatorActiveSeconds, 1200);
  assert.equal(file.operatorActiveAlgorithm, 'idle-cap-v1:900');
  assert.equal(file.operatorId, 'op-1');
  assert.deepEqual(validateSessionFile(file, allocationConfig), []);
});

test('an undeclared operator is recorded as missing, not guessed', () => {
  const file = buildSessionFile(
    { ...baseSession, operatorId: 'someone-else' },
    allocationConfig,
  );
  assert.equal(file.operatorId, null);
});

test('the local check outcome is recorded', () => {
  const file = buildSessionFile(
    {
      ...baseSession,
      localCheck: { outcome: 'failed', command: 'npm run check' },
    },
    DEFAULT_CONFIG,
  );
  assert.deepEqual(file.localCheck, {
    outcome: 'failed',
    command: 'npm run check',
  });
});

test('the session file path is partitioned by month', () => {
  assert.equal(
    sessionFilePath('s-1', '2026-09-21T11:00:00Z'),
    '.telemetry/sessions/2026-09/s-1.json',
  );
});

test('trailers parse from the final paragraph only', () => {
  const message =
    'feat(x): thing\n\nBody: not a trailer paragraph because of this line\n\nSpec: add-thing\nSession: s-1\nChange: c-1\n';
  assert.deepEqual(parseTrailers(message), {
    Spec: ['add-thing'],
    Session: ['s-1'],
    Change: ['c-1'],
  });
  assert.deepEqual(parseTrailers('feat(x): thing\n'), {});
});

test('an over-long subject and a disabled unit are rejected', () => {
  const long = `feat(x): ${'a'.repeat(100)}\n\nSpec: add-thing\n`;
  assert.ok(
    validateMessage(long, DEFAULT_CONFIG).some((error) =>
      error.includes('limit is 100'),
    ),
  );
  const disabled = parseConfig(
    JSON.stringify({ effort: { storyPoints: { enabled: false } } }),
  ).config;
  assert.ok(
    validateMessage('feat(x): thing\n\nStory-Points: 3\n', disabled).some(
      (error) => error.includes('Story-Points is disabled'),
    ),
  );
  assert.deepEqual(
    validateMessage(
      'feat(x): thing\n\nStory-Points: 3\nSession: none\n',
      DEFAULT_CONFIG,
    ),
    [],
  );
});

test('formatTrailers keeps the canonical order', () => {
  assert.deepEqual(formatTrailers({ Session: 's-1', Spec: 'add-thing' }), [
    'Spec: add-thing',
    'Session: s-1',
  ]);
});

test('configuration rejects names, addresses, and rates', () => {
  const { errors } = parseConfig(
    JSON.stringify({
      costAllocation: { enabled: true, operators: ['ada@example.com'] },
    }),
  );
  assert.ok(errors.some((error) => error.includes('pseudonymous')));
  const withRate = parseConfig(
    JSON.stringify({ costAllocation: { enabled: true, hourlyRate: 100 } }),
  );
  assert.ok(withRate.errors.some((error) => error.includes('hourlyRate')));
  const reserved = parseConfig(
    JSON.stringify({ costAllocation: { costClasses: ['unclassified'] } }),
  );
  assert.ok(reserved.errors.some((error) => error.includes('unclassified')));
});

test('a session whose figures the harness could not supply is recorded as missing, never as zero cost', () => {
  const {
    inputTokens,
    outputTokens,
    cachedTokens,
    costUsd,
    ...withoutFigures
  } = baseSession;
  void inputTokens;
  void outputTokens;
  void cachedTokens;
  void costUsd;
  const file = buildSessionFile(
    { ...withoutFigures, figuresSource: 'not supplied by the harness' },
    DEFAULT_CONFIG,
  );
  assert.equal(file.figuresMissing, true);
  assert.equal(file.costUsd, 0);
  assert.deepEqual(validateSessionFile(file, DEFAULT_CONFIG), []);
  const errors = validateSessionFile(
    { ...baseSession, figuresMissing: false },
    DEFAULT_CONFIG,
  );
  assert.ok(errors.some((error) => error.startsWith('figuresMissing')));
});

function summaryRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dev-ledger-summary-'));
  const run = (args: string[]) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  run(['init', '--quiet', '--initial-branch=main']);
  run(['config', 'user.email', 'contributor@example.invalid']);
  run(['config', 'user.name', 'contributor']);
  writeFileSync(join(dir, 'README.md'), 'base\n');
  run(['add', '--all']);
  run(['commit', '--quiet', '-m', 'chore: base']);
  run(['switch', '--quiet', '-c', 'work']);
  return dir;
}

function writeRecord(
  dir: string,
  sessionId: string,
  extra: Record<string, unknown>,
): void {
  const path = join(dir, '.telemetry', 'sessions', '2026-09');
  mkdirSync(path, { recursive: true });
  writeFileSync(
    join(path, `${sessionId}.json`),
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
        branch: 'work',
        commits: [],
        localCheck: { outcome: 'passed', command: 'npm run check' },
        ...extra,
      },
      null,
      2,
    ) + '\n',
  );
}

test('a branch with no session record says so explicitly', () => {
  const dir = summaryRepo();
  const summary = sessionSummary(dir, 'main', 'HEAD');
  assert.match(summary, /### Session records on this branch/);
  assert.match(summary, /This branch adds no session record\./);
  assert.doesNotMatch(summary, /\| record \|/);
});

test('the summary names a record with figures and one without, and embeds both', () => {
  const dir = summaryRepo();
  const run = (args: string[]) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  writeRecord(dir, 's-paid', {});
  writeRecord(dir, 's-blind', {
    figuresMissing: true,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    costUsd: 0,
    localCheck: { outcome: 'not-run', command: 'npm run check' },
  });
  run(['add', '--all']);
  run(['commit', '--quiet', '-m', 'chore(telemetry): record sessions']);
  const summary = sessionSummary(dir, 'main', 'HEAD');
  assert.match(
    summary,
    /\| `\.telemetry\/sessions\/2026-09\/s-paid\.json` \| `s-paid` \| provider-a \/ model-x \| 1,000 in · 200 out · 100 cached · \$0\.50 \| passed \|/,
  );
  assert.match(
    summary,
    /`s-blind` \| provider-a \/ model-x \| figures missing \| not-run \|/,
  );
  // The record that reports nothing must not be summarised as costing nothing.
  const blindRow = summary
    .split('\n')
    .find((line) => line.includes('`s-blind`') && line.startsWith('|'))!;
  assert.doesNotMatch(blindRow, /\$0\.00/);
  assert.match(summary, /<details><summary><code>s-paid<\/code><\/summary>/);
  assert.match(summary, /"sessionId": "s-blind"/);
});
