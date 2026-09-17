import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderBoard } from './board.ts';
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
// cursor, board. Everything runs against the working copy and the local mirrors.

const USAGE = `Usage: telemetry <command> [options]

  sync                                     Mirror-fetch every registered repository over SSH
  rebuild                                  Rebuild the projection from the mirrors and print its hash
  cursor <consumer> [--repo <name>]        Replay changes since the consumer's cursor and advance it
  board                                    Render The Board from the projection
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
      const results = syncAll(stateRoot(root), loadRegistry(root));
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
    case 'board': {
      process.stdout.write(renderBoard(readProjection(stateRoot(root))) + '\n');
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
