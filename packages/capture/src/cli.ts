import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DEFAULT_CONFIG, parseConfig, type TelemetryConfig } from './config.ts';
import {
  SESSIONS_PATH,
  buildSessionFile,
  sessionFilePath,
  validateSessionFile,
  type SessionInput,
} from './session.ts';
import { validateMessage } from './trailers.ts';

// The capture command line: what the hooks and the harness call. It needs nothing but git and this
// package, so a repository can record sessions before the flow package exists.
//   session start --id <id>          record the active session in local git configuration
//   session end --payload <file|->   write the session file from the harness's figures and commit it
//   validate [paths...]              validate session files against the schema
//   validate-message <file>          validate a commit message's subject and trailers

export const CONFIG_PATH = 'telemetry.config.json';

function git(dir: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
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

function sessionFiles(root: string, paths: string[]): string[] {
  if (paths.length > 0) {
    return paths.map((path) => resolve(root, path));
  }
  if (!existsSync(join(root, '.telemetry', 'sessions'))) {
    return [];
  }
  return git(root, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    '.telemetry/sessions',
  ])
    .split('\n')
    .filter((path) => path.endsWith('.json'))
    .map((path) => join(root, path));
}

/**
 * The Markdown section describing every session record added between two refs: a table to scan and each
 * record's own content beneath it. Built from git and the session files alone, so it holds wherever a
 * repository records sessions, with or without the flow package.
 */
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
      `| \`${path}\` | \`${record.sessionId}\` | ${record.provider} / ${record.model} | ${figures} | ${check ?? '—'} |`,
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
        process.stdout.write(
          `session ${id} recorded in local git configuration\n`,
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
        try {
          git(root, ['config', '--unset', 'telemetry.session']);
        } catch {
          // no active session was recorded
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
        'usage: telemetry session start --id <id> | telemetry session end --payload <file|-> | telemetry session summary [--base <ref>] [--head <ref>]',
      );
      break;
    }
    case 'validate': {
      const config = loadConfig(root);
      let failed = 0;
      for (const path of sessionFiles(root, args)) {
        let errors: string[];
        try {
          errors = validateSessionFile(
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
      process.stdout.write('session files valid\n');
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
