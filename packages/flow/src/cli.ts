import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { renderLedger } from './ledger.ts';
import { renderLedgerHtml } from './ledger-html.ts';
import { advanceCursor, readCursor, writeCursor } from './cursor.ts';
import { git } from './git.ts';
import {
  buildProjection,
  readProjection,
  sha256,
  canonicalJson,
  writeProjection,
} from './projection.ts';
import { parseRegistry } from './registry.ts';
import { mirrorPath, syncAll } from './sync.ts';

// `scripts/telemetry.sh` delegates here. Subcommands: sync, rebuild,
// cursor, ledger. Everything runs against the working copy and the local mirrors.

const USAGE = `Usage: telemetry <command> [options]

  sync [--entry NAME --fetch-url URL]       Mirror-fetch every registered repository over SSH, optionally
                                           fetching one named entry from a different URL
  rebuild                                  Rebuild the projection from the mirrors and print its hash
  cursor <consumer> [--repo <name>]        Replay changes since the consumer's cursor and advance it
  ledger [--html [path]]                    Render The Ledger in the terminal, or as a static HTML page (default .telemetry/ledger.html)
`;

function repoRoot(): string {
  return git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
}

function stateRoot(root: string): string {
  return join(root, '.telemetry');
}

function loadRegistry(root: string) {
  const path = join(root, 'registry.json');
  if (!existsSync(path)) {
    fail('registry.json not found; add one with a repositories list');
  }
  const { registry, errors } = parseRegistry(readFileSync(path, 'utf8'));
  if (errors.length > 0) {
    fail(`registry.json is invalid:\n  ${errors.join('\n  ')}`);
  }
  return registry;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function main(argv: string[]): number {
  const [command, ...args] = argv;
  const root = repoRoot();
  switch (command) {
    case 'sync': {
      const registry = loadRegistry(root);
      const entry = option(args, '--entry');
      const fetchUrl = option(args, '--fetch-url');
      if ((entry === undefined) !== (fetchUrl === undefined)) {
        process.stderr.write(
          'sync: --entry and --fetch-url are used together\n',
        );
        return 1;
      }
      if (
        entry !== undefined &&
        !registry.repositories.some((candidate) => candidate.name === entry)
      ) {
        process.stderr.write(`sync: no registered repository named ${entry}\n`);
        return 1;
      }
      const results = syncAll(
        stateRoot(root),
        registry,
        entry !== undefined && fetchUrl !== undefined
          ? { name: entry, url: fetchUrl }
          : undefined,
      );
      for (const result of results) {
        process.stdout.write(
          result.reachable
            ? `${result.name}: ${Object.keys(result.refTips).length} refs fetched\n`
            : `${result.name}: unreachable (${result.reason})\n`,
        );
      }
      return 0;
    }
    case 'rebuild': {
      const state = stateRoot(root);
      const projection = buildProjection(state, loadRegistry(root));
      const { path, hash } = writeProjection(state, projection);
      process.stdout.write(`${path}\nsha256 ${hash}\n`);
      return 0;
    }
    case 'cursor': {
      const consumer = args[0];
      if (!consumer) {
        fail('cursor requires a consumer name');
      }
      const state = stateRoot(root);
      const registry = loadRegistry(root);
      const only = option(args, '--repo');
      const cursor = readCursor(state, consumer);
      for (const entry of registry.repositories) {
        if (only && entry.name !== only) {
          continue;
        }
        const mirror = mirrorPath(state, entry);
        if (!existsSync(mirror)) {
          process.stdout.write(`${entry.name}: not synced\n`);
          continue;
        }
        const run = advanceCursor(
          mirror,
          entry.defaultBranch,
          entry.name,
          cursor,
        );
        if (run.reset) {
          process.stdout.write(
            `${entry.name}: cursor ${run.reset.invalid} unreachable; reset to ${run.reset.resetTo ?? 'the beginning'}\n`,
          );
        }
        process.stdout.write(
          `${entry.name}: ${run.processed.length} commits from ${run.from ?? 'the beginning'} to ${run.to}\n`,
        );
        for (const commit of run.processed) {
          process.stdout.write(`  ${commit}\n`);
        }
      }
      writeCursor(state, consumer, cursor);
      return 0;
    }
    case 'ledger': {
      const projection = readProjection(stateRoot(root));
      const htmlIndex = args.indexOf('--html');
      if (htmlIndex >= 0) {
        const target = resolve(
          root,
          args[htmlIndex + 1] ?? join('.telemetry', 'ledger.html'),
        );
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, renderLedgerHtml(projection));
        process.stdout.write(`${target}\n`);
        return 0;
      }
      process.stdout.write(renderLedger(projection) + '\n');
      return 0;
    }
    case 'hash': {
      const projection = readProjection(stateRoot(root));
      process.stdout.write(
        projection
          ? sha256(canonicalJson(projection)) + '\n'
          : 'no projection\n',
      );
      return 0;
    }
    default:
      process.stdout.write(USAGE);
      return command ? 1 : 0;
  }
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  process.exit(main(process.argv.slice(2)));
}
