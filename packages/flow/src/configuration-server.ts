import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  PLANS_PATH,
  SUBSCRIPTIONS_PATH,
  validatePlansFile,
  validateSubscriptionFile,
} from '@dev-ledger/capture';

// The configuration surface, served against the working copy on the loopback interface and nowhere else.
//
// It writes plan declarations and subscription cost records — the two figures only a person knows — and
// nothing else. It never commits, stages, or runs git: the working copy changes, `git status` shows what,
// and an operator reviews a diff before anything is history. That is the same line `subscription close`
// draws, extended to say which files a person may revise from a browser.
//
// Its security model is that it is not on the network. Binding loopback and refusing any other address is
// what makes that true, and it is checked rather than assumed; there is no password because the surface
// grants no authority the shell that launched it does not already have.

export const LOOPBACK = '127.0.0.1';

/** The only paths this surface may write. Configuration is revisable; records of what happened are not. */
export function writablePath(root: string, path: string): string | null {
  const normalised = path.replace(/^\/+/, '');
  const allowed =
    normalised === PLANS_PATH ||
    /^\.telemetry\/subscriptions\/\d{4}-(0[1-9]|1[0-2])\/[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(
      normalised,
    );
  if (!allowed) {
    return null;
  }
  const absolute = resolve(root, normalised);
  // Defence in depth: a path that escapes the working copy is refused even if it matched above.
  return absolute.startsWith(resolve(root) + '/') ? absolute : null;
}

/** Validates a payload for the path it is destined for, so no surface-specific rules diverge. */
export function validateForPath(path: string, value: unknown): string[] {
  if (path.endsWith('plans.json')) {
    return validatePlansFile(value);
  }
  return validateSubscriptionFile(value);
}

export type ConfigurationWrite = {
  path: string;
  body: unknown;
};

/** Applies one write, or returns why it was refused. Never touches git. */
export function applyWrite(
  root: string,
  write: ConfigurationWrite,
): { ok: true; path: string } | { ok: false; errors: string[] } {
  const absolute = writablePath(root, write.path);
  if (absolute === null) {
    return {
      ok: false,
      errors: [
        `${write.path} is not a configuration file; only ${PLANS_PATH} and ${SUBSCRIPTIONS_PATH}/<period>/<plan>.json may be written`,
      ],
    };
  }
  const errors = validateForPath(write.path, write.body);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(write.body, null, 2)}\n`);
  return { ok: true, path: write.path };
}

export type ServeOptions = {
  root: string;
  port: number;
  host?: string;
  page: () => string;
};

/**
 * Starts the surface. A host that is not loopback is refused rather than bound: a tool whose security story
 * is "it is not on the network" is only as good as that claim being enforced.
 */
export function serveConfiguration(options: ServeOptions): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const host = options.host ?? LOOPBACK;
  if (host !== LOOPBACK && host !== 'localhost' && host !== '::1') {
    return Promise.reject(
      new Error(
        `refusing to bind ${host}: the configuration surface serves the loopback interface only`,
      ),
    );
  }
  const server = createServer(
    (request: IncomingMessage, response: ServerResponse) => {
      if (request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(options.page());
        return;
      }
      if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', () => {
          let write: ConfigurationWrite;
          try {
            write = JSON.parse(body) as ConfigurationWrite;
          } catch (error) {
            response.writeHead(400, { 'content-type': 'application/json' });
            response.end(
              JSON.stringify({ errors: [(error as Error).message] }),
            );
            return;
          }
          const result = applyWrite(options.root, write);
          response.writeHead(result.ok ? 200 : 400, {
            'content-type': 'application/json',
          });
          response.end(JSON.stringify(result));
        });
        return;
      }
      response.writeHead(405, { 'content-type': 'text/plain' });
      response.end('method not allowed\n');
    },
  );
  return new Promise((resolveStart, rejectStart) => {
    server.on('error', rejectStart);
    server.listen(options.port, host, () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address ? address.port : options.port;
      resolveStart({
        url: `http://${host}:${port}/`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

/** Reads a configuration file from the working copy, for the surface to render. */
export function readConfiguration(root: string, path: string): unknown {
  const absolute = writablePath(root, path);
  if (absolute === null || !existsSync(absolute)) {
    return null;
  }
  return JSON.parse(readFileSync(absolute, 'utf8')) as unknown;
}
