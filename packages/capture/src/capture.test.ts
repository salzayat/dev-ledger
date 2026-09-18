import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONFIG, parseConfig } from './config.ts';
import {
  buildSessionFile,
  attributeTranscriptTime,
  computeOperatorActiveSeconds,
  sessionFilePath,
  validateSessionFile,
} from './session.ts';
import { formatTrailers, parseTrailers, validateMessage } from './trailers.ts';
import { gitEnvironment, sessionSummary } from './cli.ts';
import { operatorPromptTimes, sumTranscriptUsage } from './figures.ts';
import {
  buildSubscriptionFile,
  subscriptionFilePath,
  validateSubscriptionFile,
} from './subscription.ts';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

test('time between prompts splits into operator, autonomous, and idle', () => {
  // 10:00 prompt; the agent works until 10:40; the operator reads and replies at 10:45.
  // Then a second prompt at 11:30 with no agent activity between: the thread sat open.
  const events = [
    { timestamp: '2026-09-18T10:00:00Z', kind: 'prompt' as const },
    { timestamp: '2026-09-18T10:20:00Z', kind: 'agent' as const },
    { timestamp: '2026-09-18T10:40:00Z', kind: 'agent' as const },
    { timestamp: '2026-09-18T10:45:00Z', kind: 'prompt' as const },
    { timestamp: '2026-09-18T11:30:00Z', kind: 'prompt' as const },
  ];
  const split = attributeTranscriptTime(events, 900);

  // First gap: 40 minutes autonomous, then 5 minutes of a person reading and typing.
  // Second gap: 45 minutes with nobody producing — 15 capped as the operator, 30 idle.
  assert.equal(split.agentAutonomousSeconds, 40 * 60);
  assert.equal(split.operatorActiveSeconds, 5 * 60 + 15 * 60);
  assert.equal(split.idleSeconds, 30 * 60);

  // The three account for the whole span between first and last prompt, which is what makes them checkable.
  const span = 90 * 60;
  assert.equal(
    split.agentAutonomousSeconds +
      split.operatorActiveSeconds +
      split.idleSeconds,
    span,
  );

  // A flat cap over the same gaps cannot tell the agent's 40 minutes from the person's 5.
  assert.equal(
    computeOperatorActiveSeconds(
      events.filter((event) => event.kind === 'prompt').map((e) => e.timestamp),
      900,
    ),
    30 * 60,
    'the flat cap charges the unattended agent run to the operator',
  );
  assert.ok(
    split.operatorActiveSeconds < 30 * 60,
    'attribution reports less man time than the flat cap, because it knows who was producing',
  );
});

test('operator hours count prompts and never tool results', () => {
  // Shaped like a real transcript: a prompt, a long unattended agent turn whose tool results come back as
  // user-addressed records, then the next prompt. Only the two prompts are operator events.
  const lines = [
    JSON.stringify({
      type: 'user',
      timestamp: '2026-09-18T10:00:00Z',
      message: { content: 'do the thing' },
    }),
  ];
  for (let index = 0; index < 40; index += 1) {
    lines.push(
      JSON.stringify({
        type: 'user',
        timestamp: `2026-09-18T10:${String(index + 1).padStart(2, '0')}:00Z`,
        message: {
          content: [{ type: 'tool_result', content: 'file contents here' }],
        },
      }),
    );
    lines.push(
      JSON.stringify({
        type: 'assistant',
        timestamp: `2026-09-18T10:${String(index + 1).padStart(2, '0')}:30Z`,
        message: { content: [{ type: 'text', text: 'working' }] },
      }),
    );
  }
  lines.push(
    JSON.stringify({
      type: 'user',
      timestamp: '2026-09-18T10:50:00Z',
      message: { content: [{ type: 'text', text: 'now the next thing' }] },
    }),
  );
  const text = lines.join('\n');

  const times = operatorPromptTimes(text);
  assert.deepEqual(times, ['2026-09-18T10:00:00Z', '2026-09-18T10:50:00Z']);

  // Fifty minutes apart, capped at fifteen: the operator was away while the agent worked.
  assert.equal(computeOperatorActiveSeconds(times, 900), 900);
  // Uncapped it would have been the whole span, which is what counting tool results would have produced.
  assert.equal(computeOperatorActiveSeconds(times, 86_400), 3000);
});

test('a transcript with one prompt records no operator time at all', () => {
  const one = JSON.stringify({
    type: 'user',
    timestamp: '2026-09-18T10:00:00Z',
    message: { content: 'only this' },
  });
  assert.equal(operatorPromptTimes(one).length, 1);
  const config = {
    ...DEFAULT_CONFIG,
    costAllocation: {
      ...DEFAULT_CONFIG.costAllocation,
      enabled: true,
      operators: ['op-1'],
    },
  };
  const file = buildSessionFile({ ...baseSession, operatorEvents: [] }, config);
  assert.equal(
    file.operatorActiveSeconds,
    undefined,
    'no events measures no engagement, and an absent figure is not a zero',
  );
  assert.deepEqual(validateSessionFile(file, config), []);
});

test('a present operator figure is still checked', () => {
  const config = {
    ...DEFAULT_CONFIG,
    costAllocation: {
      ...DEFAULT_CONFIG.costAllocation,
      enabled: true,
      operators: ['op-1'],
    },
  };
  const file = buildSessionFile(
    {
      ...baseSession,
      operatorEvents: ['2026-09-18T10:00:00Z', '2026-09-18T10:05:00Z'],
    },
    config,
  );
  assert.equal(file.operatorActiveSeconds, 300);
  assert.match(String(file.operatorActiveAlgorithm), /^idle-cap-v1:/);
  assert.deepEqual(validateSessionFile(file, config), []);
  assert.deepEqual(
    validateSessionFile({ ...file, operatorActiveSeconds: -1 }, config),
    ['operatorActiveSeconds must be a non-negative number when present'],
  );
});

test('only timestamps leave a transcript when operator hours are derived', () => {
  const text = [
    JSON.stringify({
      type: 'user',
      timestamp: '2026-09-18T10:00:00Z',
      message: { content: 'my secret prompt text' },
    }),
    JSON.stringify({
      type: 'user',
      timestamp: '2026-09-18T10:10:00Z',
      message: { content: [{ type: 'text', text: 'another secret' }] },
    }),
  ].join('\n');
  const serialized = JSON.stringify(operatorPromptTimes(text));
  assert.doesNotMatch(serialized, /secret/);
});

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

test('a message with no Session trailer is valid, and a malformed identifier is not', () => {
  // Absence is the honest state when no session was active: the projection reads it as undeclared. Only a
  // present-but-malformed value is an error.
  const withoutSession = ['chore(repo): work', '', 'Change: c-1'].join('\n');
  assert.deepEqual(validateMessage(withoutSession, DEFAULT_CONFIG), []);

  const declared = [
    'chore(repo): work',
    '',
    'Session: none',
    'Change: c-1',
  ].join('\n');
  assert.deepEqual(validateMessage(declared, DEFAULT_CONFIG), []);

  const identified = [
    'chore(repo): work',
    '',
    'Session: s-20260918-x',
    'Change: c-1',
  ].join('\n');
  assert.deepEqual(validateMessage(identified, DEFAULT_CONFIG), []);

  const malformed = ['chore(repo): work', '', 'Session: not a session'].join(
    '\n',
  );
  assert.ok(
    validateMessage(malformed, DEFAULT_CONFIG).some((error) =>
      error.startsWith('Session:'),
    ),
    'a malformed identifier is still rejected',
  );
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

// A git child must never inherit this process's index or repository: these tests run under the pre-commit
// hook, which exports GIT_INDEX_FILE and GIT_DIR, and a `git add` in a fixture directory would otherwise
// write fixture paths into the real repository's index.
function fixtureGit(dir: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    env: gitEnvironment(),
  });
}

function summaryRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dev-ledger-summary-'));
  const run = (args: string[]) => fixtureGit(dir, args);
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

test('a pipe in a record field cannot end its table cell', () => {
  const dir = summaryRepo();
  writeRecord(dir, 's-piped', { model: 'model|x' });
  fixtureGit(dir, ['add', '--all']);
  fixtureGit(dir, [
    'commit',
    '--quiet',
    '-m',
    'chore(telemetry): record session',
  ]);
  assert.match(
    sessionSummary(dir, 'main', 'HEAD'),
    /\| `s-piped` \| provider-a \/ model\\\|x \| 1,000 in/,
  );
});

test('a branch with no session record says so explicitly', () => {
  const dir = summaryRepo();
  const summary = sessionSummary(dir, 'main', 'HEAD');
  assert.match(summary, /### Session records on this branch/);
  assert.match(summary, /This branch adds no session record\./);
  assert.doesNotMatch(summary, /\| record \|/);
});

test('the summary names a record with figures and one without, and embeds both', () => {
  const dir = summaryRepo();
  const run = (args: string[]) => fixtureGit(dir, args);
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

test('a git child never inherits the caller index or repository', () => {
  process.env.GIT_INDEX_FILE = '/nonexistent/index';
  process.env.GIT_DIR = '/nonexistent/.git';
  try {
    const dir = summaryRepo();
    assert.equal(
      fixtureGit(dir, ['rev-parse', '--is-inside-work-tree']).trim(),
      'true',
    );
    assert.match(sessionSummary(dir, 'main', 'HEAD'), /no session record/);
    assert.equal(gitEnvironment().GIT_INDEX_FILE, undefined);
    assert.equal(gitEnvironment().GIT_DIR, undefined);
  } finally {
    delete process.env.GIT_INDEX_FILE;
    delete process.env.GIT_DIR;
  }
});

const transcriptLine = (
  id: string | null,
  usage: Record<string, number>,
  extra: Record<string, unknown> = {},
) =>
  JSON.stringify({
    type: 'assistant',
    message: { ...(id === null ? {} : { id }), usage, ...extra },
  });

test('a message repeated across transcript records is counted once, from its last record', () => {
  const transcript = [
    transcriptLine('msg-1', { input_tokens: 10, output_tokens: 5 }),
    transcriptLine('msg-1', { input_tokens: 10, output_tokens: 40 }),
    transcriptLine('msg-2', { input_tokens: 3, output_tokens: 7 }),
    transcriptLine('msg-1', { input_tokens: 10, output_tokens: 90 }),
    transcriptLine(null, { input_tokens: 1, output_tokens: 1 }),
  ].join('\n');
  const figures = sumTranscriptUsage(transcript)!;
  assert.equal(figures.messages, 3);
  assert.equal(figures.inputTokens, 14);
  // A streaming record carries the message's cumulative usage, so the last one saw the whole message.
  assert.equal(figures.outputTokens, 98);
});

test('cached tokens are reads plus writes, and input counts neither', () => {
  const figures = sumTranscriptUsage(
    transcriptLine('msg-1', {
      input_tokens: 12,
      output_tokens: 4,
      cache_read_input_tokens: 900,
      cache_creation_input_tokens: 100,
    }),
  )!;
  assert.equal(figures.inputTokens, 12);
  assert.equal(figures.cachedTokens, 1000);
  assert.equal(figures.outputTokens, 4);
});

test('a transcript with nothing to sum yields no figures at all', () => {
  assert.equal(sumTranscriptUsage(''), null);
  assert.equal(sumTranscriptUsage('not json\n{"message":{"id":"a"}}\n'), null);
  assert.equal(
    sumTranscriptUsage('{"message":{"id":"a","usage":{}}}')!.messages,
    1,
  );
  // A record with no figures must still be written as missing, never as measured zeros.
  const file = buildSessionFile(
    {
      sessionId: 's-none',
      provider: 'provider-a',
      model: 'model-x',
      figuresSource: 'transcript carried no usage record',
      startedAt: '2026-09-01T09:00:00Z',
      endedAt: '2026-09-01T10:00:00Z',
      billingKind: 'subscription',
      subscriptionId: 'plan',
      branch: 'work',
      commits: [],
      localCheck: { outcome: 'passed', command: 'npm run check' },
    },
    DEFAULT_CONFIG,
  );
  assert.equal(file.figuresMissing, true);
});

test('a session recorded with a transcript carries its figures, and a stated figure wins', () => {
  const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
  const runCli = (dir: string, args: string[]) =>
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', cli, ...args],
      { cwd: dir, encoding: 'utf8', env: gitEnvironment() },
    );
  const payload = (extra: Record<string, unknown>) =>
    JSON.stringify({
      sessionId: 's-figures',
      provider: 'provider-a',
      model: 'model-x',
      figuresSource: '',
      startedAt: '2026-09-01T09:00:00Z',
      endedAt: '2026-09-01T10:00:00Z',
      billingKind: 'subscription',
      subscriptionId: 'plan',
      branch: 'work',
      commits: [],
      localCheck: { outcome: 'passed', command: 'npm run check' },
      ...extra,
    });

  const dir = summaryRepo();
  writeFileSync(
    join(dir, 'transcript.jsonl'),
    [
      transcriptLine('msg-1', { input_tokens: 20, output_tokens: 12 }),
      transcriptLine('msg-1', {
        input_tokens: 20,
        output_tokens: 30,
        cache_read_input_tokens: 40,
      }),
    ].join('\n'),
  );
  writeFileSync(join(dir, 'payload.json'), payload({}));
  runCli(dir, [
    'session',
    'end',
    '--payload',
    'payload.json',
    '--transcript',
    'transcript.jsonl',
  ]);
  const summed = JSON.parse(
    readFileSync(
      join(dir, '.telemetry/sessions/2026-09/s-figures.json'),
      'utf8',
    ),
  );
  assert.equal(summed.figuresMissing, undefined);
  assert.deepEqual(
    [summed.inputTokens, summed.outputTokens, summed.cachedTokens],
    [20, 30, 40],
  );
  assert.match(summed.figuresSource, /summed from 1 messages/);

  // A payload written before the sum says the harness had no figures; once the transcript supplied
  // them, that source would describe figures the record does not carry.
  const stale = summaryRepo();
  writeFileSync(
    join(stale, 'transcript.jsonl'),
    readFileSync(join(dir, 'transcript.jsonl')),
  );
  writeFileSync(
    join(stale, 'payload.json'),
    payload({
      figuresSource:
        'agent session; the harness did not expose token or cost figures',
    }),
  );
  runCli(stale, [
    'session',
    'end',
    '--payload',
    'payload.json',
    '--transcript',
    'transcript.jsonl',
  ]);
  const replaced = JSON.parse(
    readFileSync(
      join(stale, '.telemetry/sessions/2026-09/s-figures.json'),
      'utf8',
    ),
  );
  assert.equal(replaced.inputTokens, 20);
  assert.match(replaced.figuresSource, /summed from 1 messages/);

  const stated = summaryRepo();
  writeFileSync(
    join(stated, 'transcript.jsonl'),
    readFileSync(join(dir, 'transcript.jsonl')),
  );
  writeFileSync(
    join(stated, 'payload.json'),
    payload({
      inputTokens: 5,
      outputTokens: 6,
      cachedTokens: 7,
      figuresSource: 'harness',
    }),
  );
  runCli(stated, [
    'session',
    'end',
    '--payload',
    'payload.json',
    '--transcript',
    'transcript.jsonl',
  ]);
  const kept = JSON.parse(
    readFileSync(
      join(stated, '.telemetry/sessions/2026-09/s-figures.json'),
      'utf8',
    ),
  );
  assert.deepEqual(
    [
      kept.inputTokens,
      kept.outputTokens,
      kept.cachedTokens,
      kept.figuresSource,
    ],
    [5, 6, 7, 'harness'],
  );
});

test('a subscription cost record validates, and a rate cannot enter it', () => {
  const file = buildSubscriptionFile({
    planId: 'plan-max',
    period: '2026-09',
    amount: 200,
    currency: 'usd',
  });
  assert.deepEqual(validateSubscriptionFile(file), []);
  assert.equal(file.currency, 'USD');
  assert.equal(file.overageAmount, 0);
  assert.equal(
    subscriptionFilePath('plan-max', '2026-09'),
    '.telemetry/subscriptions/2026-09/plan-max.json',
  );
  const errors = validateSubscriptionFile({
    ...file,
    hourlyRate: 90,
    period: '2026-13',
    amount: -1,
    currency: 'dollars',
  });
  assert.ok(errors.some((error) => error.startsWith('hourlyRate')));
  assert.ok(errors.some((error) => error.startsWith('period')));
  assert.ok(errors.some((error) => error.startsWith('amount')));
  assert.ok(errors.some((error) => error.startsWith('currency')));
  assert.throws(() => subscriptionFilePath('plan', '2026-9'));
});

test('subscription record writes the period file and validate reads both record kinds', () => {
  const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
  const dir = summaryRepo();
  const runCli = (args: string[]) =>
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', cli, ...args],
      { cwd: dir, encoding: 'utf8', env: gitEnvironment() },
    );
  const written = runCli([
    'subscription',
    'record',
    '--plan',
    'plan-max',
    '--period',
    '2026-09',
    '--amount',
    '200',
    '--currency',
    'USD',
    '--overage',
    '12.5',
  ]).trim();
  assert.equal(written, '.telemetry/subscriptions/2026-09/plan-max.json');
  const record = JSON.parse(readFileSync(join(dir, written), 'utf8'));
  assert.equal(record.overageAmount, 12.5);
  assert.match(
    fixtureGit(dir, ['log', '-1', '--format=%s']),
    /record subscription plan-max 2026-09/,
  );
  writeRecord(dir, 's-ok', {});
  assert.match(runCli(['validate']), /2 records valid/);
  writeFileSync(
    join(dir, '.telemetry/subscriptions/2026-09/bad.json'),
    JSON.stringify({ ...record, planId: 'bad', salary: 1 }),
  );
  assert.throws(() => runCli(['validate']), /salary is not allowed/);
});
