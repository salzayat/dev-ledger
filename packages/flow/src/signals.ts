import type { TelemetryConfig } from '@dev-ledger/capture';
import type { Association, UnmergedPullRequest } from './association.ts';
import type { Change } from './history.ts';
import type { Thresholds } from './registry.ts';
import type { ChangeSessions, SessionRecord } from './sessions.ts';
import type { SubscriptionRecord } from './subscriptions.ts';
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
    unmergedPullRequests: Spend & {
      excluded: { invalidSession: number; missingFigures: number };
    };
    perUnmergedPullRequest: Record<
      string,
      {
        pullRequest: number;
        spend: Spend;
        missingFigures: number;
        invalidSession: number;
        cites: string[];
      }
    >;
  };
  dora: DoraSignals;
  trends: { weekly: WeeklyBucket[]; note: string };
  costClasses: CostClassSpend;
  coverage: Coverage;
  allocation: Allocation;
  signals: Signal[];
};

/** An apportioned amount: a share of a subscription period, never a reported figure. */
export type AllocatedSpend = {
  amount: number;
  overage: number;
  sessions: number;
  /** True when any share came from a period whose end had not passed as of the newest commit. */
  provisional: boolean;
  cites: string[];
};

export type AllocationPeriod = {
  period: string;
  planId: string;
  currency: string;
  amount: number;
  overageAmount: number;
  record: string;
  provisional: boolean;
  /** Sessions that took a share. */
  allocated: number;
  /** Sessions in the period with no agent run seconds: excluded and counted, never given zero. */
  excludedNoAgentSeconds: number;
  /** True when no session could take a share, so the whole amount is reported as unallocated. */
  unallocated: boolean;
  cites: string[];
};

export type AllocationAggregates = {
  total: AllocatedSpend;
  byChange: Record<string, AllocatedSpend>;
  bySpec: Record<string, AllocatedSpend>;
  byProvider: Record<string, AllocatedSpend>;
  byModel: Record<string, AllocatedSpend>;
  unmergedPullRequests: AllocatedSpend;
  perUnmergedPullRequest: Record<string, AllocatedSpend>;
};

export type Allocation = {
  trust: string[];
  producer: 'operator';
  basis: 'agentRunSeconds';
  periods: AllocationPeriod[];
  bySession: Record<
    string,
    {
      period: string;
      planId: string;
      currency: string;
      amount: number;
      overage: number;
      provisional: boolean;
    }
  >;
  /** Aggregates keyed by currency, because two currencies never sum. */
  currencies: Record<string, AllocationAggregates>;
  excluded: {
    noAgentSeconds: number;
    noPeriodRecord: number;
    invalidSession: number;
    invalidRecord: number;
  };
  note: string;
};

export type DoraSignals = {
  deploymentFrequency: {
    releases: number;
    days: number | null;
    perWeek: number | null;
    tags: string[];
    note: string;
  };
  leadTimeToRelease: Distribution & { mergeToTag: Distribution; note: string };
  changeFailureRate: {
    escapes: number;
    releases: number;
    perRelease: number | null;
    cites: string[];
    note: string;
  };
  timeToFix: Distribution & { note: string };
};

export type WeeklyBucket = {
  week: string;
  changes: number;
  costUsd: number;
  sessions: number;
  cites: string[];
};

export type CostClassSpend = Record<string, Spend & { missingFigures: number }>;

export type Coverage = {
  total: number;
  agent: number;
  humanOnly: number;
  undeclared: number;
  unreported: number;
};

export type ReleaseSummary = {
  tag: string;
  changes: string[];
  at: string | null;
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

/**
 * Adds a record's figures to a total, and reports whether it did. A record carrying `figuresMissing` is
 * refused here rather than at each call site: the caller decides which excluded counter to raise, never
 * whether the rule applies.
 */
function add(into: Spend, record: SessionRecord): boolean {
  const file = record.file;
  if (!file || file.figuresMissing) {
    return false;
  }
  into.inputTokens += file.inputTokens;
  into.outputTokens += file.outputTokens;
  into.cachedTokens += file.cachedTokens;
  into.costUsd = Math.round((into.costUsd + file.costUsd) * 1e6) / 1e6;
  into.sessions += 1;
  into.cites.push(record.path);
  return true;
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

function distributionOf(
  entries: { value: number | null; cite: string; reason?: string }[],
): Distribution {
  const excluded: Record<string, number> = {};
  const values: number[] = [];
  const cites: string[] = [];
  for (const entry of entries) {
    if (entry.value === null) {
      const reason = entry.reason ?? 'unknown';
      excluded[reason] = (excluded[reason] ?? 0) + 1;
    } else {
      values.push(entry.value);
      cites.push(entry.cite);
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

/** The Monday on or before the date, as YYYY-MM-DD. */
function weekOf(iso: string): string {
  const date = new Date(iso);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function emptyAllocated(): AllocatedSpend {
  return { amount: 0, overage: 0, sessions: 0, provisional: false, cites: [] };
}

function addAllocated(
  into: AllocatedSpend,
  share: Allocation['bySession'][string],
  cite: string,
): void {
  into.amount = Math.round((into.amount + share.amount) * 1e6) / 1e6;
  into.overage = Math.round((into.overage + share.overage) * 1e6) / 1e6;
  into.sessions += 1;
  into.provisional = into.provisional || share.provisional;
  into.cites.push(cite);
}

/** Apportions one amount over weights, rounded to a millionth, with the remainder on the last share. */
function apportion(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights.map(
    (weight) => Math.round(((amount * weight) / total) * 1e6) / 1e6,
  );
  const assigned = shares.reduce((sum, share) => sum + share, 0);
  if (shares.length > 0) {
    shares[shares.length - 1] =
      Math.round((shares[shares.length - 1] + amount - assigned) * 1e6) / 1e6;
  }
  return shares;
}

/** The first instant after a `YYYY-MM` period. */
function periodEnd(period: string): number {
  const [year, month] = period.split('-').map(Number);
  return Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1);
}

/**
 * Subscription spend, allocated by agent run seconds. A session's marginal cost on a subscription is
 * zero and stays zero in its record; what the plan cost is a period fact, apportioned here across the
 * period's sessions. A session with no agent seconds takes no share and is counted, never given zero.
 */
function computeAllocation(
  facts: ChangeFacts[],
  sessions: Map<string, SessionRecord>,
  subscriptions: SubscriptionRecord[],
  now: string,
): Allocation {
  const allocation: Allocation = {
    trust: ['allocated'],
    producer: 'operator',
    basis: 'agentRunSeconds',
    periods: [],
    bySession: {},
    currencies: {},
    excluded: {
      noAgentSeconds: 0,
      noPeriodRecord: 0,
      invalidSession: 0,
      invalidRecord: 0,
    },
    note: 'a subscription session records no marginal cost; the period amount is apportioned across its sessions by agent run seconds, and a figure from a period that has not closed is provisional',
  };
  const nowMs = Date.parse(now);
  const byPeriodAndPlan = new Map<string, SubscriptionRecord>();
  for (const record of subscriptions) {
    if (!record.file) {
      allocation.excluded.invalidRecord += 1;
      continue;
    }
    byPeriodAndPlan.set(`${record.file.period}/${record.file.planId}`, record);
  }
  const members = new Map<string, SessionRecord[]>();
  for (const record of [...sessions.values()].sort((a, b) =>
    a.sessionId.localeCompare(b.sessionId),
  )) {
    const file = record.file;
    if (!file) {
      allocation.excluded.invalidSession += 1;
      continue;
    }
    if (file.billingKind !== 'subscription') {
      continue;
    }
    const key = `${file.endedAt.slice(0, 7)}/${file.subscriptionId}`;
    if (!byPeriodAndPlan.has(key)) {
      allocation.excluded.noPeriodRecord += 1;
      continue;
    }
    (members.get(key) ?? members.set(key, []).get(key)!).push(record);
  }
  for (const [key, record] of [...byPeriodAndPlan.entries()].sort()) {
    const file = record.file!;
    const inPeriod = members.get(key) ?? [];
    const eligible = inPeriod.filter(
      (member) => member.file!.agentRunSeconds > 0,
    );
    const excludedNoAgentSeconds = inPeriod.length - eligible.length;
    allocation.excluded.noAgentSeconds += excludedNoAgentSeconds;
    const provisional = periodEnd(file.period) > nowMs;
    const weights = eligible.map((member) => member.file!.agentRunSeconds);
    const amounts = apportion(file.amount, weights);
    const overages = apportion(file.overageAmount, weights);
    eligible.forEach((member, index) => {
      allocation.bySession[member.sessionId] = {
        period: file.period,
        planId: file.planId,
        currency: file.currency,
        amount: amounts[index],
        overage: overages[index],
        provisional,
      };
    });
    allocation.periods.push({
      period: file.period,
      planId: file.planId,
      currency: file.currency,
      amount: file.amount,
      overageAmount: file.overageAmount,
      record: record.path,
      provisional,
      allocated: eligible.length,
      excludedNoAgentSeconds,
      unallocated: eligible.length === 0,
      cites: [record.path, ...inPeriod.map((member) => member.path)],
    });
  }
  const aggregates = (currency: string): AllocationAggregates =>
    (allocation.currencies[currency] ??= {
      total: emptyAllocated(),
      byChange: {},
      bySpec: {},
      byProvider: {},
      byModel: {},
      unmergedPullRequests: emptyAllocated(),
      perUnmergedPullRequest: {},
    });
  for (const fact of facts) {
    for (const id of fact.sessions.sessions) {
      const share = allocation.bySession[id];
      const record = sessions.get(id);
      if (!share || !record?.file) {
        continue;
      }
      const into = aggregates(share.currency);
      addAllocated(into.total, share, record.path);
      addAllocated(
        (into.byChange[fact.change.id] ??= emptyAllocated()),
        share,
        record.path,
      );
      const spec =
        typeof fact.change.trailers.Spec === 'string'
          ? fact.change.trailers.Spec
          : (record.file.spec ?? '(none)');
      addAllocated(
        (into.bySpec[spec] ??= emptyAllocated()),
        share,
        record.path,
      );
      addAllocated(
        (into.byProvider[record.file.provider] ??= emptyAllocated()),
        share,
        record.path,
      );
      addAllocated(
        (into.byModel[record.file.model] ??= emptyAllocated()),
        share,
        record.path,
      );
    }
  }
  for (const record of sessions.values()) {
    const number = record.attribution.unmergedPullRequest;
    const share = allocation.bySession[record.sessionId];
    if (number === null || !share || !record.file) {
      continue;
    }
    const into = aggregates(share.currency);
    addAllocated(into.total, share, record.path);
    addAllocated(into.unmergedPullRequests, share, record.path);
    addAllocated(
      (into.perUnmergedPullRequest[String(number)] ??= emptyAllocated()),
      share,
      record.path,
    );
    addAllocated(
      (into.byProvider[record.file.provider] ??= emptyAllocated()),
      share,
      record.path,
    );
    addAllocated(
      (into.byModel[record.file.model] ??= emptyAllocated()),
      share,
      record.path,
    );
  }
  return allocation;
}

export function computeSignals(
  facts: ChangeFacts[],
  sessions: Map<string, SessionRecord>,
  unmerged: UnmergedPullRequest[],
  releases: ReleaseSummary[],
  subscriptions: SubscriptionRecord[],
  thresholds: Thresholds,
  configAt: (change: Change) => TelemetryConfig,
  now: string,
): RepositorySignals {
  const allocation = computeAllocation(facts, sessions, subscriptions, now);
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
    unmergedPullRequests: {
      ...emptySpend(),
      excluded: { invalidSession: 0, missingFigures: 0 },
    },
    perUnmergedPullRequest: {},
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
  // Unmerged work is totalled under the same rule as merged work: a record with no figures is counted as
  // excluded, never as a zero, both for the pull request and for the aggregate.
  for (const record of sessions.values()) {
    const number = record.attribution.unmergedPullRequest;
    if (number === null) {
      continue;
    }
    const entry = (spend.perUnmergedPullRequest[String(number)] ??= {
      pullRequest: number,
      spend: emptySpend(),
      missingFigures: 0,
      invalidSession: 0,
      cites: [],
    });
    entry.cites.push(record.path);
    if (!record.file) {
      entry.invalidSession += 1;
      spend.unmergedPullRequests.excluded.invalidSession += 1;
      continue;
    }
    if (!add(entry.spend, record)) {
      entry.missingFigures += 1;
      spend.unmergedPullRequests.excluded.missingFigures += 1;
      continue;
    }
    add(spend.unmergedPullRequests, record);
  }

  // DORA, approximated to the release tag. Every note says what stands in for what.
  const dated = releases
    .filter((release) => release.at !== null)
    .sort((a, b) => Date.parse(a.at!) - Date.parse(b.at!));
  const releaseSpan =
    dated.length > 1
      ? Math.max(
          1,
          (Date.parse(dated[dated.length - 1].at!) - Date.parse(dated[0].at!)) /
            86_400_000,
        )
      : null;
  const deploymentFrequency = {
    releases: dated.length,
    days: releaseSpan === null ? null : Math.round(releaseSpan * 100) / 100,
    perWeek:
      releaseSpan === null
        ? null
        : Math.round((dated.length / (releaseSpan / 7)) * 100) / 100,
    tags: dated.map((release) => release.tag),
    note: 'release tags stand in for deployments; deployments are not observed in phase one',
  };
  const carriedBy = new Map<string, ReleaseSummary>();
  for (const release of dated) {
    for (const id of release.changes) {
      if (!carriedBy.has(id)) {
        carriedBy.set(id, release);
      }
    }
  }
  const leadEntries = facts.map((fact) => {
    const release = carriedBy.get(fact.change.id);
    if (!release) {
      return { value: null, cite: fact.change.id, reason: 'unreleased' };
    }
    if (fact.timing.firstAuthoredAt === null) {
      return {
        value: null,
        cite: fact.change.id,
        reason: fact.timing.reason ?? 'no-pull-head',
      };
    }
    return {
      value: Math.max(
        0,
        Math.round(
          (Date.parse(release.at!) - Date.parse(fact.timing.firstAuthoredAt)) /
            1000,
        ),
      ),
      cite: fact.change.id,
    };
  });
  const mergeToTagEntries = facts.map((fact) => {
    const release = carriedBy.get(fact.change.id);
    return release
      ? {
          value: Math.max(
            0,
            Math.round(
              (Date.parse(release.at!) - Date.parse(fact.change.mergeTime)) /
                1000,
            ),
          ),
          cite: fact.change.id,
        }
      : { value: null, cite: fact.change.id, reason: 'unreleased' };
  });
  const leadTimeToRelease = {
    ...distributionOf(leadEntries),
    mergeToTag: distributionOf(mergeToTagEntries),
    note: 'from the first commit on the pull request to the release tag that carried the change; a deployment record would end it at the environment instead',
  };
  const changeFailureRate = {
    escapes: escapes.changes.length,
    releases: dated.length,
    perRelease:
      dated.length > 0
        ? Math.round((escapes.changes.length / dated.length) * 100) / 100
        : null,
    cites: escapes.changes.map((entry) => entry.change),
    note: 'escapes (reverts and fixes after the newest release touching released files) per release tag in the window',
  };
  const factById = new Map(facts.map((fact) => [fact.change.id, fact]));
  const releasedFacts = newest
    ? newest.changes
        .map((id) => factById.get(id))
        .filter((fact): fact is ChangeFacts => fact !== undefined)
    : [];
  const timeToFix = {
    ...distributionOf(
      escapes.changes.map((escape) => {
        const fix = factById.get(escape.change);
        const target = [...releasedFacts]
          .reverse()
          .find((candidate) =>
            candidate.files.some((file) => escape.files.includes(file)),
          );
        if (!fix || !target) {
          return { value: null, cite: escape.change, reason: 'no-target' };
        }
        return {
          value: Math.max(
            0,
            Math.round(
              (Date.parse(fix.change.mergeTime) -
                Date.parse(target.change.mergeTime)) /
                1000,
            ),
          ),
          cite: `${fix.change.id}<-${target.change.id}`,
        };
      }),
    ),
    note: 'from the merge of the released change an escape targets to the merge of the escape; restore in production would need a deployment record',
  };
  const dora: DoraSignals = {
    deploymentFrequency,
    leadTimeToRelease,
    changeFailureRate,
    timeToFix,
  };

  // Weekly trends over the measured window, one bucket per Monday-started week.
  const weeklyMap = new Map<string, WeeklyBucket>();
  if (facts.length > 0) {
    const first = weekOf(facts.map((fact) => fact.change.mergeTime).sort()[0]);
    const last = weekOf(
      facts
        .map((fact) => fact.change.mergeTime)
        .sort()
        .at(-1)!,
    );
    for (
      let cursor = Date.parse(`${first}T00:00:00Z`);
      cursor <= Date.parse(`${last}T00:00:00Z`);
      cursor += 7 * 86_400_000
    ) {
      const week = new Date(cursor).toISOString().slice(0, 10);
      weeklyMap.set(week, {
        week,
        changes: 0,
        costUsd: 0,
        sessions: 0,
        cites: [],
      });
    }
    for (const fact of facts) {
      const bucket = weeklyMap.get(weekOf(fact.change.mergeTime))!;
      bucket.changes += 1;
      bucket.cites.push(fact.change.id);
      const changeSpend = spend.byChange[fact.change.id];
      if (changeSpend) {
        bucket.costUsd =
          Math.round((bucket.costUsd + changeSpend.costUsd) * 1e6) / 1e6;
        bucket.sessions += changeSpend.sessions;
      }
    }
  }
  const trends = {
    weekly: [...weeklyMap.values()],
    note: 'weeks start on Monday; cost is the session cost of changes merged that week, records without figures excluded',
  };

  // Spend by cost class: the session's own class, then the change's trailer, never a default.
  const costClasses: CostClassSpend = {};
  const classSpend = (name: string) =>
    (costClasses[name] ??= { ...emptySpend(), missingFigures: 0 });
  for (const fact of facts) {
    const trailerClass =
      typeof fact.change.trailers['Cost-Class'] === 'string'
        ? fact.change.trailers['Cost-Class']
        : null;
    for (const id of fact.sessions.sessions) {
      const record = sessions.get(id);
      if (!record?.file) {
        continue;
      }
      const name = record.file.costClass ?? trailerClass ?? 'unclassified';
      if (!add(classSpend(name), record)) {
        classSpend(name).missingFigures += 1;
        classSpend(name).cites.push(record.path);
      }
    }
  }
  const coverage: Coverage = {
    total: facts.length,
    agent: facts.filter(
      (fact) =>
        fact.sessions.status === 'declared' &&
        fact.sessions.sessions.length > 0,
    ).length,
    humanOnly: spend.excluded.humanOnly,
    undeclared: spend.excluded.undeclared,
    unreported: spend.excluded.unreported,
  };

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
    dora,
    trends,
    costClasses,
    coverage,
    allocation,
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
