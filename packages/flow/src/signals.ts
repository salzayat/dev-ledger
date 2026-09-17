import type { TelemetryConfig } from '@dev-ledger/capture';
import type { Association, UnmergedPullRequest } from './association.ts';
import type { Change } from './history.ts';
import type { Thresholds } from './registry.ts';
import type { ChangeSessions, SessionRecord } from './sessions.ts';
import type { Timing } from './timing.ts';

// The flow signals. Every read states the trust classes it used and how many changes it excluded, cites
// the changes behind it, and never keys anything to a person.

export type Distribution = {
  count: number;
  /** The median: half the changes were faster, half slower. */
  p50: number | null;
  /** Nine in ten changes came in under this. */
  p90: number | null;
  /** The slowest change. */
  max: number | null;
  excluded: Record<string, number>;
  trust: string[];
  cites: string[];
};

export type Spend = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  sessions: number;
  cites: string[];
};

export type Signal = {
  signal: string;
  threshold: number;
  observed: number;
  cites: string[];
};

export type RepositorySignals = {
  cycleTime: Distribution;
  waitTime: Distribution;
  queue: {
    count: number;
    oldestAgeSeconds: number | null;
    pullRequests: UnmergedPullRequest[];
    trust: string[];
    note: string;
  };
  batchSize: {
    count: number;
    medianFiles: number | null;
    medianLines: number | null;
    medianCommits: number | null;
    cites: string[];
  };
  mergeFrequency: {
    changes: number;
    days: number | null;
    perDay: number | null;
    trust: string[];
  };
  rework: {
    windowDays: number;
    pairs: { later: string; earlier: string; files: string[] }[];
  };
  escapes: {
    release: string | null;
    changes: { change: string; kind: 'revert' | 'fix'; files: string[] }[];
  };
  localChecks: Record<string, number>;
  spend: {
    trust: string[];
    total: Spend;
    byChange: Record<string, Spend>;
    bySpec: Record<string, Spend>;
    byProvider: Record<string, Spend>;
    byModel: Record<string, Spend>;
    perEffortUnit: Record<
      string,
      {
        unit: string;
        costPerUnit: number | null;
        changes: number;
        excluded: number;
        cites: string[];
      }
    >;
    excluded: {
      undeclared: number;
      unreported: number;
      humanOnly: number;
      invalidSession: number;
      missingFigures: number;
    };
    unmergedPullRequests: Spend;
  };
  signals: Signal[];
};

export type ChangeFacts = {
  change: Change;
  association: Association;
  timing: Timing;
  sessions: ChangeSessions;
  files: string[];
  insertions: number;
  deletions: number;
};

function percentile(sorted: number[], fraction: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index];
}

function median(values: number[]): number | null {
  return percentile(
    [...values].sort((a, b) => a - b),
    0.5,
  );
}

function emptySpend(): Spend {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    costUsd: 0,
    sessions: 0,
    cites: [],
  };
}

function add(into: Spend, record: SessionRecord): void {
  const file = record.file!;
  into.inputTokens += file.inputTokens;
  into.outputTokens += file.outputTokens;
  into.cachedTokens += file.cachedTokens;
  into.costUsd = Math.round((into.costUsd + file.costUsd) * 1e6) / 1e6;
  into.sessions += 1;
  into.cites.push(record.path);
}

function distribution(
  facts: ChangeFacts[],
  pick: (timing: Timing) => number | null,
): Distribution {
  const excluded: Record<string, number> = {};
  const values: number[] = [];
  const cites: string[] = [];
  for (const fact of facts) {
    const value = pick(fact.timing);
    if (value === null) {
      const reason = fact.timing.reason ?? 'unknown';
      excluded[reason] = (excluded[reason] ?? 0) + 1;
    } else {
      values.push(value);
      cites.push(fact.change.id);
    }
  }
  values.sort((a, b) => a - b);
  return {
    count: values.length,
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    max: values.length ? values[values.length - 1] : null,
    excluded,
    trust: ['observed'],
    cites,
  };
}

export function computeSignals(
  facts: ChangeFacts[],
  sessions: Map<string, SessionRecord>,
  unmerged: UnmergedPullRequest[],
  releases: { tag: string; changes: string[] }[],
  thresholds: Thresholds,
  configAt: (change: Change) => TelemetryConfig,
  now: string,
): RepositorySignals {
  const cycleTime = distribution(facts, (timing) => timing.cycleTimeSeconds);
  const waitTime = distribution(facts, (timing) => timing.waitTimeSeconds);
  const nowMs = Date.parse(now);
  const ages = unmerged.map((entry) =>
    entry.oldestCommitAt
      ? Math.max(
          0,
          Math.round((nowMs - Date.parse(entry.oldestCommitAt)) / 1000),
        )
      : 0,
  );
  const queue = {
    count: unmerged.length,
    oldestAgeSeconds: ages.length ? Math.max(...ages) : null,
    pullRequests: unmerged,
    trust: ['observed'],
    note: 'open or closed is not observable from git; age is measured from the oldest commit not on the default branch',
  };
  const batchSize = {
    count: facts.length,
    medianFiles: median(facts.map((fact) => fact.files.length)),
    medianLines: median(facts.map((fact) => fact.insertions + fact.deletions)),
    medianCommits: median(
      facts.map((fact) => fact.change.branchCommits.length),
    ),
    cites: facts.map((fact) => fact.change.id),
  };
  const mergeTimes = facts
    .map((fact) => Date.parse(fact.change.mergeTime))
    .sort((a, b) => a - b);
  const days =
    mergeTimes.length > 1
      ? Math.max(
          1,
          (mergeTimes[mergeTimes.length - 1] - mergeTimes[0]) / 86_400_000,
        )
      : null;
  const mergeFrequency = {
    changes: facts.length,
    days: days === null ? null : Math.round(days * 100) / 100,
    perDay:
      days === null ? null : Math.round((facts.length / days) * 100) / 100,
    trust: ['observed'],
  };

  const windowDays = thresholds.reworkWindowDays ?? 14;
  const rework: RepositorySignals['rework'] = { windowDays, pairs: [] };
  for (let later = 0; later < facts.length; later += 1) {
    const laterFact = facts[later];
    const laterTime = Date.parse(laterFact.change.mergeTime);
    for (let earlier = later - 1; earlier >= 0; earlier -= 1) {
      const earlierFact = facts[earlier];
      if (
        laterTime - Date.parse(earlierFact.change.mergeTime) >
        windowDays * 86_400_000
      ) {
        break;
      }
      const shared = laterFact.files.filter(
        (file) =>
          earlierFact.files.includes(file) && !file.startsWith('.telemetry/'),
      );
      if (shared.length > 0) {
        rework.pairs.push({
          later: laterFact.change.id,
          earlier: earlierFact.change.id,
          files: shared,
        });
      }
    }
  }

  const newest = releases[releases.length - 1] ?? null;
  const escapes: RepositorySignals['escapes'] = {
    release: newest?.tag ?? null,
    changes: [],
  };
  if (newest) {
    const releasedIds = new Set(newest.changes);
    const releasedFiles = new Set(
      facts
        .filter((fact) => releasedIds.has(fact.change.id))
        .flatMap((fact) => fact.files),
    );
    for (const fact of facts) {
      if (releasedIds.has(fact.change.id)) {
        continue;
      }
      const subject = fact.change.subject;
      const kind = /^Revert\b/.test(subject)
        ? 'revert'
        : /^fix(\(|:)/.test(subject)
          ? 'fix'
          : null;
      if (!kind) {
        continue;
      }
      const files = fact.files.filter(
        (file) => releasedFiles.has(file) && !file.startsWith('.telemetry/'),
      );
      if (files.length > 0) {
        escapes.changes.push({ change: fact.change.id, kind, files });
      }
    }
  }

  const localChecks: Record<string, number> = {};
  const spend: RepositorySignals['spend'] = {
    trust: ['reported'],
    total: emptySpend(),
    byChange: {},
    bySpec: {},
    byProvider: {},
    byModel: {},
    perEffortUnit: {},
    excluded: {
      undeclared: 0,
      unreported: 0,
      humanOnly: 0,
      invalidSession: 0,
      missingFigures: 0,
    },
    unmergedPullRequests: emptySpend(),
  };
  const effortAccumulators: Record<
    string,
    {
      unit: string;
      cost: number;
      units: number;
      changes: number;
      excluded: number;
      cites: string[];
    }
  > = {};
  for (const fact of facts) {
    const config = configAt(fact.change);
    if (fact.sessions.status === 'undeclared') {
      spend.excluded.undeclared += 1;
    } else if (fact.sessions.status === 'human-only') {
      spend.excluded.humanOnly += 1;
    }
    if (fact.sessions.unreported.length > 0) {
      spend.excluded.unreported += 1;
    }
    const changeSpend = emptySpend();
    for (const id of fact.sessions.sessions) {
      const record = sessions.get(id);
      if (!record?.file) {
        spend.excluded.invalidSession += 1;
        continue;
      }
      if (record.file.figuresMissing) {
        spend.excluded.missingFigures += 1;
        const outcome = record.file.localCheck.outcome;
        localChecks[outcome] = (localChecks[outcome] ?? 0) + 1;
        continue;
      }
      const outcome = record.file.localCheck.outcome;
      localChecks[outcome] = (localChecks[outcome] ?? 0) + 1;
      add(changeSpend, record);
      add(spend.total, record);
      add((spend.byProvider[record.file.provider] ??= emptySpend()), record);
      add((spend.byModel[record.file.model] ??= emptySpend()), record);
      const spec =
        typeof fact.change.trailers.Spec === 'string'
          ? fact.change.trailers.Spec
          : (record.file.spec ?? '(none)');
      add((spend.bySpec[spec] ??= emptySpend()), record);
    }
    if (changeSpend.sessions > 0) {
      spend.byChange[fact.change.id] = changeSpend;
    }
    const complete =
      changeSpend.sessions > 0 &&
      fact.sessions.unreported.length === 0 &&
      fact.sessions.status === 'declared';
    const units: [string, boolean, number | null][] = [
      [
        'storyPoints',
        config.effort.storyPoints.enabled,
        numberOr(fact.change.trailers['Story-Points']),
      ],
      [
        'workHours',
        config.effort.workHours.enabled,
        numberOr(fact.change.trailers['Work-Hours']),
      ],
      [
        'agentWallClockSeconds',
        true,
        wallClock(fact.sessions.sessions, sessions),
      ],
    ];
    for (const [unit, enabled, value] of units) {
      if (!enabled) {
        continue;
      }
      const accumulator = (effortAccumulators[unit] ??= {
        unit,
        cost: 0,
        units: 0,
        changes: 0,
        excluded: 0,
        cites: [],
      });
      if (complete && value !== null && value > 0) {
        accumulator.cost += changeSpend.costUsd;
        accumulator.units += value;
        accumulator.changes += 1;
        accumulator.cites.push(fact.change.id);
      } else {
        accumulator.excluded += 1;
      }
    }
  }
  for (const [unit, accumulator] of Object.entries(effortAccumulators)) {
    spend.perEffortUnit[unit] = {
      unit,
      costPerUnit:
        accumulator.units > 0
          ? Math.round((accumulator.cost / accumulator.units) * 1e6) / 1e6
          : null,
      changes: accumulator.changes,
      excluded: accumulator.excluded,
      cites: accumulator.cites,
    };
  }
  for (const record of sessions.values()) {
    if (record.attribution.unmergedPullRequest !== null && record.file) {
      add(spend.unmergedPullRequests, record);
    }
  }

  const signals: Signal[] = [];
  if (
    thresholds.waitTimeP50Seconds !== undefined &&
    waitTime.p50 !== null &&
    waitTime.p50 > thresholds.waitTimeP50Seconds
  ) {
    signals.push({
      signal: 'wait-time-p50',
      threshold: thresholds.waitTimeP50Seconds,
      observed: waitTime.p50,
      cites: facts
        .filter(
          (fact) =>
            (fact.timing.waitTimeSeconds ?? -1) >
            thresholds.waitTimeP50Seconds!,
        )
        .map((fact) => fact.change.id),
    });
  }
  if (
    thresholds.cycleTimeP50Seconds !== undefined &&
    cycleTime.p50 !== null &&
    cycleTime.p50 > thresholds.cycleTimeP50Seconds
  ) {
    signals.push({
      signal: 'cycle-time-p50',
      threshold: thresholds.cycleTimeP50Seconds,
      observed: cycleTime.p50,
      cites: facts
        .filter(
          (fact) =>
            (fact.timing.cycleTimeSeconds ?? -1) >
            thresholds.cycleTimeP50Seconds!,
        )
        .map((fact) => fact.change.id),
    });
  }
  if (
    thresholds.queueAgeSeconds !== undefined &&
    queue.oldestAgeSeconds !== null &&
    queue.oldestAgeSeconds > thresholds.queueAgeSeconds
  ) {
    signals.push({
      signal: 'queue-age',
      threshold: thresholds.queueAgeSeconds,
      observed: queue.oldestAgeSeconds,
      cites: unmerged
        .filter((entry, index) => ages[index] > thresholds.queueAgeSeconds!)
        .map((entry) => `pull/${entry.number}`),
    });
  }
  if (thresholds.batchSizeLines !== undefined) {
    const over = facts.filter(
      (fact) => fact.insertions + fact.deletions > thresholds.batchSizeLines!,
    );
    if (over.length > 0) {
      signals.push({
        signal: 'batch-size-lines',
        threshold: thresholds.batchSizeLines,
        observed: Math.max(
          ...over.map((fact) => fact.insertions + fact.deletions),
        ),
        cites: over.map((fact) => fact.change.id),
      });
    }
  }

  return {
    cycleTime,
    waitTime,
    queue,
    batchSize,
    mergeFrequency,
    rework,
    escapes,
    localChecks,
    spend,
    signals,
  };
}

function numberOr(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function wallClock(
  ids: string[],
  sessions: Map<string, SessionRecord>,
): number | null {
  let total = 0;
  let any = false;
  for (const id of ids) {
    const file = sessions.get(id)?.file;
    if (file) {
      total += file.wallClockSeconds;
      any = true;
    }
  }
  return any ? total : null;
}
