import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DEFAULT_CONFIG, parseConfig, type TelemetryConfig } from './config.ts';
import {
  attributeTranscriptTime,
  SESSIONS_PATH,
  buildSessionFile,
  sessionFilePath,
  validateSessionFile,
  type SessionInput,
  ATTRIBUTION_ALGORITHM,
  type TimeAttribution,
} from './session.ts';
import {
  SUBSCRIPTIONS_PATH,
  PLANS_PATH,
  amountFor,
  buildSubscriptionFile,
  subscriptionFilePath,
  type PlansFile,
  type SubscriptionCostFile,
  validatePlansFile,
  validateSubscriptionFile,
} from './subscription.ts';
import { validateMessage } from './trailers.ts';
import {
  transcriptEvents,
  sumTranscriptUsage,
  transcriptFiguresSource,
  type Figures,
} from './figures.ts';

// The capture command line: what the hooks and the harness call. It needs nothing but git and this
// package, so a repository can record sessions before the flow package exists.
//   session start --id <id>          record the active session in local git configuration
//   session human-only [--clear]     declare this branch human-only, so its commits carry Session: none
//   session end --payload <file|->   write the session file from the harness's figures and commit it
//   subscription record ...          write a subscription cost record for one billing period and commit it
//   subscription close <YYYY-MM>     write one record per declared plan for that period, without committing
//   validate [paths...]              validate session and subscription records against their schemas
//   validate-message <file>          validate a commit message's subject and trailers

export const CONFIG_PATH = 'telemetry.config.json';

/** Git's own variables, exported by every hook, and never what a child of this command should act on. */
const INHERITED_GIT_VARIABLES = [
  'GIT_DIR',
  'GIT_INDEX_FILE',
  'GIT_WORK_TREE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_PREFIX',
  'GIT_COMMON_DIR',
];

/**
 * The environment for a git child: the caller's, minus anything that would point the child at another
 * repository or index. Capture's commands run inside hooks, where those variables are set, so a command
 * must act on the working copy it was given and never on the caller's index.
 */
export function gitEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    LC_ALL: 'C',
  };
  for (const name of INHERITED_GIT_VARIABLES) {
    delete env[name];
  }
  return env;
}

function git(dir: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: gitEnvironment(),
  });
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function loadConfig(root: string): TelemetryConfig {
  const path = join(root, CONFIG_PATH);
  if (!existsSync(path)) {
    return DEFAULT_CONFIG;
  }
  const { config, errors } = parseConfig(readFileSync(path, 'utf8'));
  if (errors.length > 0) {
    fail(`telemetry.config.json is invalid:\n  ${errors.join('\n  ')}`);
  }
  return config;
}

/** Canonical JSON: sorted keys at every level, two-space indent, trailing newline. */
export function canonicalJson(value: unknown): string {
  const sort = (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map(sort)
      : typeof input === 'object' && input !== null
        ? Object.fromEntries(
            Object.keys(input as Record<string, unknown>)
              .sort()
              .map((key) => [
                key,
                sort((input as Record<string, unknown>)[key]),
              ]),
          )
        : input;
  return JSON.stringify(sort(value), null, 2) + '\n';
}

function recordFiles(root: string, paths: string[]): string[] {
  if (paths.length > 0) {
    return paths.map((path) => resolve(root, path));
  }
  const present = [SESSIONS_PATH, SUBSCRIPTIONS_PATH].filter((path) =>
    existsSync(join(root, path)),
  );
  if (present.length === 0) {
    return [];
  }
  return git(root, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    ...present,
  ])
    .split('\n')
    .filter((path) => path.endsWith('.json'))
    .map((path) => join(root, path));
}

/** Which schema a record file answers to, by where it lives. */
function validateRecord(
  root: string,
  path: string,
  value: unknown,
  config: TelemetryConfig,
): string[] {
  const relative = path.startsWith(root) ? path.slice(root.length + 1) : path;
  return relative.startsWith(`${SUBSCRIPTIONS_PATH}/`)
    ? validateSubscriptionFile(value)
    : validateSessionFile(value, config);
}

/**
 * The Markdown section describing every session record added between two refs: a table to scan and each
 * record's own content beneath it. Built from git and the session files alone, so it holds wherever a
 * repository records sessions, with or without the flow package.
 */
/** A value placed in a Markdown table cell: a pipe would end the cell, so it is escaped. */
function cell(value: unknown): string {
  return String(value).replace(/\|/g, '\\|');
}

export function sessionSummary(
  root: string,
  base: string,
  head: string,
): string {
  const range = `${base}..${head}`;
  const added = git(root, [
    'diff',
    '--name-only',
    '--diff-filter=AM',
    range,
    '--',
    `${SESSIONS_PATH}/`,
  ])
    .split('\n')
    .map((path) => path.trim())
    .filter((path) => path.endsWith('.json'))
    .sort();
  if (added.length === 0) {
    return `### Session records on this branch\n\nThis branch adds no session record.\n`;
  }
  const rows: string[] = [];
  const bodies: string[] = [];
  for (const path of added) {
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(git(root, ['show', `${head}:${path}`])) as Record<
        string,
        unknown
      >;
    } catch {
      rows.push(`| \`${path}\` | — | — | unreadable | — |`);
      continue;
    }
    const figures = record.figuresMissing
      ? 'figures missing'
      : `${Number(record.inputTokens ?? 0).toLocaleString('en-US')} in · ` +
        `${Number(record.outputTokens ?? 0).toLocaleString('en-US')} out · ` +
        `${Number(record.cachedTokens ?? 0).toLocaleString('en-US')} cached · ` +
        `$${Number(record.costUsd ?? 0).toFixed(2)}`;
    const check = (record.localCheck as { outcome?: string } | undefined)
      ?.outcome;
    rows.push(
      `| \`${path}\` | \`${cell(record.sessionId)}\` | ${cell(record.provider)} / ${cell(record.model)} | ${figures} | ${cell(check ?? '—')} |`,
    );
    bodies.push(
      `<details><summary><code>${record.sessionId}</code></summary>\n\n\`\`\`json\n${canonicalJson(record).trimEnd()}\n\`\`\`\n\n</details>`,
    );
  }
  return [
    '### Session records on this branch',
    '',
    '| record | session | provider / model | figures | check |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    'A record whose harness supplied no figures reads `figures missing`: it is excluded from every total',
    'and counted, never read as zero.',
    '',
    ...bodies,
    '',
  ].join('\n');
}

function readTranscriptFigures(
  root: string,
  path: string | undefined,
): Figures | null {
  if (!path) {
    fail('--transcript requires a file path');
  }
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    return null;
  }
  return sumTranscriptUsage(readFileSync(absolute, 'utf8'));
}

/**
 * Operator active seconds from the same transcript the token figures come from. Fewer than two prompts
 * leaves the figure absent rather than zero: one prompt measures no engagement, and a zero would claim the
 * operator was present for none of a session they started.
 */
function readTranscriptAttribution(
  root: string,
  path: string | undefined,
  idleCapSeconds: number,
): TimeAttribution | null {
  if (!path) {
    return null;
  }
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    return null;
  }
  const events = transcriptEvents(readFileSync(absolute, 'utf8'));
  if (events.filter((event) => event.kind === 'prompt').length < 2) {
    return null;
  }
  return attributeTranscriptTime(events, idleCapSeconds);
}

/**
 * Writes one period record per declared plan, from the declarations, and stops there.
 *
 * It deliberately does not commit. A declaration says what a plan is arranged to cost; only a person knows
 * what actually came off the card, and months differ — a credit, a proration, a seat added on the
 * nineteenth. Generating figures from an intention alone would assert twelve months of spend nobody
 * checked, which is the shape of the `Session: none` defect this repository has already met once.
 */
function closePeriod(root: string, args: string[]): number {
  const period = args[1];
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    fail(
      'usage: telemetry subscription close <YYYY-MM> [--overwrite] [--force]',
    );
  }
  const plansPath = resolve(root, PLANS_PATH);
  if (!existsSync(plansPath)) {
    fail(`no plan declarations at ${PLANS_PATH}; nothing to close`);
  }
  const parsed = JSON.parse(readFileSync(plansPath, 'utf8')) as unknown;
  const errors = validatePlansFile(parsed);
  if (errors.length > 0) {
    fail(`plan declarations are invalid:\n  ${errors.join('\n  ')}`);
  }
  const plans = (parsed as PlansFile).plans;

  // A period whose end has not passed is not settled, and recording it as though it were would state a
  // figure the month can still change.
  const [year, month] = period.split('-').map(Number);
  const periodEnd = Date.UTC(year, month, 1);
  if (periodEnd > Date.now() && !args.includes('--force')) {
    fail(`${period} has not ended; pass --force to close it anyway`);
  }

  const written: string[] = [];
  const kept: string[] = [];
  const uncovered: string[] = [];
  for (const plan of plans) {
    const amount = amountFor(plan, period);
    if (amount === null) {
      uncovered.push(plan.planId);
      continue;
    }
    const relative = subscriptionFilePath(plan.planId, period);
    const absolute = resolve(root, relative);
    if (existsSync(absolute) && !args.includes('--overwrite')) {
      const current = JSON.parse(
        readFileSync(absolute, 'utf8'),
      ) as SubscriptionCostFile;
      kept.push(
        current.amount === amount
          ? `${relative} (unchanged)`
          : `${relative} (would become ${amount} ${plan.currency}, is ${current.amount})`,
      );
      continue;
    }
    const file = buildSubscriptionFile({
      planId: plan.planId,
      period,
      amount,
      currency: plan.currency,
      overageAmount: 0,
    });
    const invalid = validateSubscriptionFile(file);
    if (invalid.length > 0) {
      fail(`${relative} is invalid:\n  ${invalid.join('\n  ')}`);
    }
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, canonicalJson(file));
    written.push(relative);
  }

  for (const path of written) {
    process.stdout.write(`${path}\n`);
  }
  for (const note of kept) {
    process.stdout.write(`kept ${note}\n`);
  }
  for (const planId of uncovered) {
    process.stdout.write(
      `${planId}: no interval covers ${period}; nothing written\n`,
    );
  }
  process.stdout.write(
    written.length > 0
      ? 'Review the diff and commit; nothing was committed.\n'
      : 'Nothing written.\n',
  );
  return 0;
}

export function captureMain(argv: string[]): number {
  const [command, ...args] = argv;
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  switch (command) {
    case 'session': {
      if (args[0] === 'start') {
        const id = option(args, '--id');
        if (!id) {
          fail('session start requires --id');
        }
        git(root, ['config', 'telemetry.session', id]);
        // The clock at start is the one fact only this command can record: a session file written later
        // from a payload gets its start from here rather than from a hand-typed timestamp.
        git(root, [
          'config',
          'telemetry.session-started',
          new Date().toISOString(),
        ]);
        process.stdout.write(
          `session ${id} recorded in local git configuration\n`,
        );
        return 0;
      }
      if (args[0] === 'human-only') {
        // A declaration, not a default: `Session: none` says a person did this work without an agent, and
        // only an operator knows that. It is branch-local like every other trailer value the hook reads.
        const branch = git(root, ['branch', '--show-current']).trim();
        if (!branch) {
          fail('session human-only requires a branch');
        }
        const key = `branch.${branch}.telemetry-human-only`;
        if (args.includes('--clear')) {
          try {
            git(root, ['config', '--unset', key]);
          } catch {
            // nothing declared for this branch
          }
          process.stdout.write(
            `${branch} no longer declares human-only work; commits with no active session are undeclared\n`,
          );
          return 0;
        }
        git(root, ['config', key, 'true']);
        process.stdout.write(
          `${branch} declares human-only work; its commits carry Session: none\n`,
        );
        return 0;
      }
      if (args[0] === 'figures') {
        const figures = readTranscriptFigures(
          root,
          option(args, '--transcript'),
        );
        if (!figures) {
          fail(
            'no usage record in the transcript; record the session without figures',
          );
        }
        const config = loadConfig(root);
        const attribution = config.costAllocation.enabled
          ? readTranscriptAttribution(
              root,
              option(args, '--transcript'),
              config.costAllocation.idleCapSeconds,
            )
          : null;
        process.stdout.write(
          canonicalJson({
            cacheReadTokens: figures.cacheReadTokens,
            cacheWriteTokens: figures.cacheWriteTokens,
            cachedTokens: figures.cachedTokens,
            figuresSource: transcriptFiguresSource(figures),
            inputTokens: figures.inputTokens,
            ...(attribution === null
              ? {}
              : {
                  agentAutonomousSeconds: attribution.agentAutonomousSeconds,
                  idleSeconds: attribution.idleSeconds,
                  operatorActiveAlgorithm: `${ATTRIBUTION_ALGORITHM}:${config.costAllocation.idleCapSeconds}`,
                  operatorActiveSeconds: attribution.operatorActiveSeconds,
                }),
            outputTokens: figures.outputTokens,
          }),
        );
        return 0;
      }
      if (args[0] === 'end') {
        const payloadPath = option(args, '--payload') ?? '-';
        const text =
          payloadPath === '-'
            ? readFileSync(0, 'utf8')
            : readFileSync(resolve(root, payloadPath), 'utf8');
        const config = loadConfig(root);
        const input = JSON.parse(text) as SessionInput;
        // A payload may leave the clock to the commands: start is what `session start` recorded, end is
        // now. A payload that states its own times keeps them, because the harness knew something these
        // commands did not.
        if (!input.startedAt) {
          try {
            input.startedAt = git(root, [
              'config',
              '--get',
              'telemetry.session-started',
            ]).trim();
          } catch {
            // no start recorded; validation names the missing field
          }
        }
        if (!input.endedAt) {
          input.endedAt = new Date().toISOString();
        }
        // A transcript fills only what the payload left out: a harness that knows its own figures keeps
        // them, and a transcript with no usage record leaves the record missing figures as before. When
        // the transcript supplied any figure, the source says so, whatever the payload's source said:
        // a payload written before the sum can only describe figures it did not have.
        const transcript = option(args, '--transcript');
        if (transcript !== undefined) {
          const figures = readTranscriptFigures(root, transcript);
          if (figures) {
            const filled =
              input.inputTokens === undefined ||
              input.outputTokens === undefined ||
              input.cachedTokens === undefined;
            input.inputTokens ??= figures.inputTokens;
            input.outputTokens ??= figures.outputTokens;
            input.cachedTokens ??= figures.cachedTokens;
            input.cacheReadTokens ??= figures.cacheReadTokens;
            input.cacheWriteTokens ??= figures.cacheWriteTokens;
            if (filled) {
              input.figuresSource = transcriptFiguresSource(figures);
            }
          }
          // Operator seconds come from the same file and fill the same way: a payload that stated its own
          // figure keeps it, because the harness knew something the transcript cannot show.
          if (
            config.costAllocation.enabled &&
            input.operatorActiveSeconds === undefined
          ) {
            const attribution = readTranscriptAttribution(
              root,
              transcript,
              config.costAllocation.idleCapSeconds,
            );
            if (attribution !== null) {
              input.operatorActiveSeconds = attribution.operatorActiveSeconds;
              input.agentAutonomousSeconds ??=
                attribution.agentAutonomousSeconds;
              input.idleSeconds ??= attribution.idleSeconds;
            }
          }
        }
        if (config.costAllocation.enabled && input.operatorId === undefined) {
          try {
            input.operatorId = git(root, [
              'config',
              '--get',
              'telemetry.operator',
            ]).trim();
          } catch {
            input.operatorId = null;
          }
        }
        const file = buildSessionFile(input, config);
        const errors = validateSessionFile(file, config);
        if (errors.length > 0) {
          fail(`session file is invalid:\n  ${errors.join('\n  ')}`);
        }
        const relative = sessionFilePath(file.sessionId, file.endedAt);
        const absolute = join(root, relative);
        mkdirSync(dirname(absolute), { recursive: true });
        writeFileSync(absolute, canonicalJson(file));
        if (!args.includes('--no-commit')) {
          git(root, ['add', '--', relative]);
          git(root, [
            '-c',
            `telemetry.session=${file.sessionId}`,
            'commit',
            '--quiet',
            '-m',
            `chore(telemetry): record session ${file.sessionId}`,
            '--',
            relative,
          ]);
        }
        for (const key of ['telemetry.session', 'telemetry.session-started']) {
          try {
            git(root, ['config', '--unset', key]);
          } catch {
            // nothing recorded under this key
          }
        }
        process.stdout.write(`${relative}\n`);
        return 0;
      }
      if (args[0] === 'summary') {
        const base = option(args, '--base') ?? 'main';
        const head = option(args, '--head') ?? 'HEAD';
        process.stdout.write(sessionSummary(root, base, head));
        return 0;
      }
      fail(
        'usage: telemetry session start --id <id> | telemetry session human-only [--clear] | telemetry session end --payload <file|-> [--transcript <file>] | telemetry session figures --transcript <file> | telemetry session summary [--base <ref>] [--head <ref>]',
      );
      break;
    }
    case 'subscription': {
      if (args[0] === 'close') {
        return closePeriod(root, args);
      }
      if (args[0] !== 'record') {
        fail(
          'usage: telemetry subscription record --plan <id> --period <YYYY-MM> --amount <number> --currency <code> [--overage <number>] [--no-commit]\n       telemetry subscription close <YYYY-MM> [--overwrite] [--force]',
        );
      }
      const planId = option(args, '--plan');
      const period = option(args, '--period');
      const amount = Number(option(args, '--amount'));
      const currency = option(args, '--currency');
      const overage = option(args, '--overage');
      if (!planId || !period || !currency || Number.isNaN(amount)) {
        fail(
          'subscription record requires --plan, --period, --amount, and --currency',
        );
      }
      const file = buildSubscriptionFile({
        planId,
        period,
        amount,
        currency,
        overageAmount: overage === undefined ? 0 : Number(overage),
      });
      const errors = validateSubscriptionFile(file);
      if (errors.length > 0) {
        fail(`subscription cost record is invalid:\n  ${errors.join('\n  ')}`);
      }
      const relative = subscriptionFilePath(file.planId, file.period);
      const absolute = join(root, relative);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, canonicalJson(file));
      if (!args.includes('--no-commit')) {
        git(root, ['add', '--', relative]);
        git(root, [
          'commit',
          '--quiet',
          '-m',
          `chore(telemetry): record subscription ${file.planId} ${file.period}`,
          '--',
          relative,
        ]);
      }
      process.stdout.write(`${relative}\n`);
      return 0;
    }
    case 'validate': {
      const config = loadConfig(root);
      let failed = 0;
      let checked = 0;
      for (const path of recordFiles(root, args)) {
        checked += 1;
        let errors: string[];
        try {
          errors = validateRecord(
            root,
            path,
            JSON.parse(readFileSync(path, 'utf8')),
            config,
          );
        } catch (error) {
          errors = [`not valid JSON: ${(error as Error).message}`];
        }
        if (errors.length > 0) {
          failed += 1;
          process.stderr.write(`${path}:\n  ${errors.join('\n  ')}\n`);
        }
      }
      if (failed > 0) {
        return 1;
      }
      process.stdout.write(`${checked} records valid\n`);
      return 0;
    }
    case 'validate-message': {
      const path = args[0];
      if (!path) {
        fail('validate-message requires the message file path');
      }
      const errors = validateMessage(
        readFileSync(path, 'utf8').replace(/^#.*\n?/gm, ''),
        loadConfig(root),
      );
      if (errors.length > 0) {
        process.stderr.write(
          `commit message rejected:\n  ${errors.join('\n  ')}\n`,
        );
        return 1;
      }
      return 0;
    }
    default:
      fail(`unknown capture command: ${command ?? '(none)'}`);
  }
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  process.exit(captureMain(process.argv.slice(2)));
}
