import {
  SESSIONS_PATH,
  validateSessionFile,
  type SessionFile,
  type TelemetryConfig,
} from '@dev-ledger/capture';
import { readBlob, treeFiles } from './git.ts';
import type { Change, Commit, Gap } from './history.ts';
import type { PullHead } from './association.ts';

// Session records: declared by `Session:` trailers, present as files in the tree at the change's last
// commit. Missing is counted, never zeroed.

export type SessionRecord = {
  sessionId: string;
  path: string;
  producer: 'harness';
  trust: 'reported';
  valid: boolean;
  errors: string[];
  file: SessionFile | null;
  attribution: { change: string | null; unmergedPullRequest: number | null };
};

export type ChangeSessions = {
  declared: string[];
  status: 'declared' | 'undeclared' | 'human-only';
  sessions: string[];
  unreported: string[];
  gaps: Gap[];
};

function sessionIdOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
}

function load(
  dir: string,
  revision: string,
  path: string,
  config: TelemetryConfig,
): SessionRecord {
  const text = readBlob(dir, revision, path);
  let file: SessionFile | null = null;
  let errors: string[] = ['session file could not be read'];
  if (text !== null) {
    try {
      const parsed = JSON.parse(text) as SessionFile;
      errors = validateSessionFile(parsed, config);
      file = errors.length === 0 ? parsed : null;
    } catch (error) {
      errors = [`session file is not valid JSON: ${(error as Error).message}`];
    }
  }
  return {
    sessionId: sessionIdOf(path),
    path,
    producer: 'harness',
    trust: 'reported',
    valid: errors.length === 0,
    errors,
    file,
    attribution: { change: null, unmergedPullRequest: null },
  };
}

export function collectSessions(
  dir: string,
  changes: Change[],
  commits: Map<string, Commit>,
  configAt: (change: Change) => TelemetryConfig,
  filesOf: (change: Change) => string[],
): {
  sessions: Map<string, SessionRecord>;
  byChange: Map<string, ChangeSessions>;
} {
  const sessions = new Map<string, SessionRecord>();
  const byChange = new Map<string, ChangeSessions>();
  for (const change of changes) {
    const config = configAt(change);
    const declaredValues = new Set<string>();
    let sawTrailer = false;
    const messages = [change.mergeCommit, ...change.branchCommits].filter(
      (hash): hash is string => hash !== null,
    );
    for (const hash of messages) {
      for (const value of commits.get(hash)?.trailers.Session ?? []) {
        sawTrailer = true;
        if (value !== 'none') {
          declaredValues.add(value);
        }
      }
    }
    const declared = [...declaredValues].sort();
    const added = filesOf(change).filter(
      (path) => path.startsWith(`${SESSIONS_PATH}/`) && path.endsWith('.json'),
    );
    const treeAtLast = new Set(
      declared.length > 0
        ? treeFiles(dir, change.lastCommit, SESSIONS_PATH)
        : added,
    );
    const present: string[] = [];
    const unreported: string[] = [];
    const gaps: Gap[] = [];
    const attach = (path: string) => {
      const id = sessionIdOf(path);
      if (!sessions.has(id)) {
        const record = load(dir, change.lastCommit, path, config);
        record.attribution.change = change.id;
        sessions.set(id, record);
      }
      if (!present.includes(id)) {
        present.push(id);
      }
    };
    for (const path of added) {
      attach(path);
    }
    for (const id of declared) {
      const path = [...treeAtLast].find(
        (candidate) => sessionIdOf(candidate) === id,
      );
      if (path) {
        attach(path);
      } else {
        unreported.push(id);
        gaps.push({
          type: 'missing-session-record',
          detail: `session ${id} is declared but its file is absent at ${change.lastCommit}`,
        });
      }
    }
    let status: ChangeSessions['status'] = 'declared';
    if (!sawTrailer) {
      status = 'undeclared';
      gaps.push({
        type: 'undeclared-session',
        detail: `no Session: trailer on ${change.lastCommit} or its commits`,
      });
    } else if (declared.length === 0) {
      status = 'human-only';
    }
    byChange.set(change.id, {
      declared,
      status,
      sessions: present.sort(),
      unreported,
      gaps,
    });
  }
  return { sessions, byChange };
}

/** Sessions on unmerged pull heads: files on the pull head tree that never reached the default branch. */
export function collectUnmergedSessions(
  dir: string,
  branch: string,
  pullHeads: PullHead[],
  unmergedNumbers: Set<number>,
  sessions: Map<string, SessionRecord>,
  config: TelemetryConfig,
): void {
  const onMain = new Set(treeFiles(dir, branch, SESSIONS_PATH));
  for (const head of pullHeads) {
    if (!unmergedNumbers.has(head.number)) {
      continue;
    }
    for (const path of treeFiles(dir, head.tip, SESSIONS_PATH)) {
      const id = sessionIdOf(path);
      if (onMain.has(path) || sessions.has(id)) {
        continue;
      }
      const record = load(dir, head.tip, path, config);
      record.attribution.unmergedPullRequest = head.number;
      sessions.set(id, record);
    }
  }
}
