import type { TelemetryConfig } from '@dev-ledger/capture';
import type { Association, UnmergedPullRequest } from './association.ts';
import type { Change } from './history.ts';
import type { Thresholds } from './registry.ts';
import type { ChangeSessions, SessionRecord } from './sessions.ts';
import type { SubscriptionRecord } from './subscriptions.ts';
import type { CompletedTask } from './tasks.ts';
import type { Timing } from './timing.ts';

// The flow signals. Every read states the trust classes it used and how many changes it excluded, cites
// the changes behind it, and never keys anything to a person.

/**
 * What metered sessions actually cost per token. Unlike the allocated rate this divides a cost the harness
 * reported by tokens the same session reported, so it carries `reported` and involves no apportioning.
 *
 * Keyed by provider and currency and never combined across either: two providers do not count tokens the
 * same way, and two currencies do not add.
 */
export type MeteredRate = {
  provider: string;
  currency: string;
  amount: number;
  inputOutputTokens: number;
  cachedTokens: number;
  /** True when at least one contributing record carries only the combined cache figure. */
  cacheComponentsUnknown: boolean;
  perMillionInputOutput: number | null;
  sessions: number;
  /** Metered sessions that reported a cost and no tokens: counted, never shrinking the denominator quietly. */
  withoutTokens: number;
  trust: string[];
  cites: string[];
};

/** Conventional commit types the work mix reports, plus `other` for a subject that does not parse. */
export const WORK_MIX_TYPES = [
  'feat',
  'fix',
  'refactor',
  'docs',
  'test',
  'chore',
  'ci',
  'other',
] as const;

export type WorkMixType = (typeof WORK_MIX_TYPES)[number];

/** Changes and spend for one commit type in one week. */
export type WorkMixEntry = {
  changes: number;
  costUsd: number;
  cites: string[];
};

export type CheckCompliance = {
  /** Changes whose sessions recorded a local check outcome, over changes in the window. */
  recorded: number;
  changes: number;
  recordedShare: number | null;
  /** Passing outcomes over recorded outcomes. */
  passed: number;
  passRate: number | null;
  trust: string[];
};

export type Abandonment = {
  /** The age past which an unmerged pull head is reported as older than, never as closed. */
  afterSeconds: number;
  count: number;
  costUsd: number;
  tokens: number;
  /** Records on those pull heads carrying no figures: counted, never read as zero. */
  withoutFigures: number;
  trust: string[];
  cites: string[];
};

export type CostPer = {
  /** Cost over the population, or null when no cost was reported. */
  costUsd: number | null;
  /** Allocated subscription spend over the population, in `currency`, or null when nothing was allocated. */
  allocated: number | null;
  currency: string | null;
  tokens: number;
  count: number;
  excluded: number;
  /** True when every contributing session was a subscription session, so cost is fixed at zero. */
  tokensOnly: boolean;
  trust: string[];
};

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
  /** Man hours in seconds, from the operator's time between prompts. An expense in its own unit. */
  operatorSeconds: number;
  /** Time the agent produced on its own, needing nobody. */
  agentAutonomousSeconds: number;
  /** Sessions contributing no operator figure, counted rather than read as nobody present. */
  withoutOperatorTime: number;
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
    /** Globs whose files never make a pair, and how many pairs they removed. */
    ignore: string[];
    ignored: number;
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
    perMergedChange: CostPer;
    perReleasedChange: CostPer;
    perRelease: CostPer;
    perEffortUnit: Record<
      string,
      {
        unit: string;
        costPerUnit: number | null;
        allocatedPerUnit: number | null;
        currency: string | null;
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
  velocity: Velocity;
  workMix: {
    weekly: Record<string, Record<string, WorkMixEntry>>;
    note: string;
  };
  flowEfficiency: Distribution & { outsideSeconds: number; note: string };
  iterations: {
    sessionsPerChange: Distribution;
    commitsPerChange: Distribution;
  };
  abandonment: Abandonment;
  specLeadTime: Distribution;
  checkCompliance: CheckCompliance;
  meteredRates: MeteredRate[];
  costClasses: CostClassSpend;
  coverage: Coverage;
  allocation: Allocation;
  operators: Operators;
  /** What the registry declared about where measurement starts and what git cannot see. */
  boundary: {
    measuredFrom: string | null;
    preInstrumentation: number;
    declaredClosed: number[];
    note: string;
  };
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

/**
 * What the allocated amount worked out to per token. A subscription has no token component — the plan costs
 * what it costs — so this is not a price and not a fraction of the amount: it is the amount divided by the
 * tokens the sessions that took a share actually reported.
 *
 * Input plus output is the headline because those are the tokens the work asked for. Cache reads sit beside
 * it rather than in the denominator: they rise with how long a context stayed warm, and folding them in
 * makes the rate read roughly two hundred times better than the work cost.
 */
export type TokenRate = {
  amount: number;
  currency: string;
  inputOutputTokens: number;
  cachedTokens: number;
  perMillionInputOutput: number | null;
  perMillionCached: number | null;
  sessions: number;
  /** Sessions that took a share but reported no tokens, so the rate is over fewer records than it covers. */
  withoutFigures: number;
  provisional: boolean;
  cites: string[];
};

export type AllocationAggregates = {
  total: AllocatedSpend;
  rate: TokenRate;
  byChange: Record<string, AllocatedSpend>;
  bySpec: Record<string, AllocatedSpend>;
  byProvider: Record<string, AllocatedSpend>;
  byModel: Record<string, AllocatedSpend>;
  unmergedPullRequests: AllocatedSpend;
  perUnmergedPullRequest: Record<string, AllocatedSpend>;
};

/**
 * Effort keyed to an operator, covering both kinds. An agent operator is a provider and model pair and is
 * measured in the currency of the subscription allocation and in tokens. A human operator is a pseudonymous
 * identifier and is measured in hours, from `operatorActiveSeconds` under its idle cap. The two units never
 * meet in one figure: there is no rate in any record that could convert hours into money, and none is
 * invented here.
 */
export type AgentOperator = {
  provider: string;
  model: string;
  /** Allocated amounts by currency code; empty when no subscription period covers this operator's work. */
  currencies: Record<string, { amount: number; overage: number }>;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  sessions: number;
  provisional: boolean;
  cites: string[];
};

export type HumanOperator = {
  hours: number;
  sessions: number;
  cites: string[];
};

export type Operators = {
  trust: string[];
  agents: Record<string, AgentOperator>;
  humans: Record<string, HumanOperator>;
  excluded: {
    /** Changes declaring `Session: none`: human work with no record to hold its hours. */
    humanOnly: number;
    /** Sessions recorded before operator capture was enabled, which carry no identifier. */
    noOperator: number;
    invalidSession: number;
  };
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

/**
 * Throughput over the measured window, per repository and per week. Story points lead because they are the
 * unit the configuration enables and the unit cost per effort already uses; changes per week sit beside
 * them for anyone whose points are patchy. Never keyed to a person: velocity per operator is the figure this
 * methodology exists not to produce.
 */
export type Velocity = {
  trust: string[];
  weeks: number;
  /** Tasks completed in the window and their summed relative complexity, unweighted tasks counting one. */
  tasks: number;
  complexity: number;
  /** Completed tasks that declared no weight: counted one each, and stated. */
  unweightedTasks: number;
  complexityPerWeek: number | null;
  tasksPerWeek: number | null;
  storyPoints: number;
  changes: number;
  pointsPerWeek: number | null;
  changesPerWeek: number | null;
  /** Changes merged in the window recording no points, counted rather than read as zero. */
  excludedWithoutPoints: number;
  note: string;
};

export type WeeklyBucket = {
  week: string;
  /** Tasks completed by changes merged that week, and their summed relative complexity. */
  tasks: number;
  complexity: number;
  unweightedTasks: number;
  /** Story points merged that week, from the changes that recorded them. */
  storyPoints: number;
  /** Changes merged that week recording no points: excluded from velocity, never read as zero points. */
  withoutPoints: number;
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
  /** Subjects of the branch commits a merge commit brought in, oldest first; empty for a squash or a push. */
  branchSubjects: string[];
  /** OpenSpec tasks this change ticked, with their relative complexity where declared. */
  tasks: CompletedTask[];
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

function emptyCostPer(): CostPer {
  return {
    costUsd: null,
    allocated: null,
    currency: null,
    tokens: 0,
    count: 0,
    excluded: 0,
    tokensOnly: false,
    trust: ['reported', 'allocated'],
  };
}

function emptySpend(): Spend {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    costUsd: 0,
    operatorSeconds: 0,
    agentAutonomousSeconds: 0,
    withoutOperatorTime: 0,
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
  // Man hours ride beside the tokens as a second expense in its own unit. A record with no operator figure
  // is counted, not read as a session nobody worked.
  if (typeof file.operatorActiveSeconds === 'number') {
    into.operatorSeconds += file.operatorActiveSeconds;
    into.agentAutonomousSeconds += file.agentAutonomousSeconds ?? 0;
  } else {
    into.withoutOperatorTime += 1;
  }
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
 * A path glob, supporting `*` within a segment and `**` across segments. Small on purpose: the ignore list
 * names lockfiles and generated directories, and a dependency for that would be a dependency to audit.
 */
function matchesGlob(path: string, glob: string): boolean {
  const pattern = glob
    .split('')
    .map((character) => {
      if ('\\^$+?.()|{}[]'.includes(character)) {
        return `\\${character}`;
      }
      return character;
    })
    .join('')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/(?<!\.)\*/g, '[^/]*');
  return new RegExp(`^${pattern}$`).test(path);
}

/**
 * The conventional commit type on a change's subject. A subject that does not parse is `other` rather than
 * dropped, so the mix always accounts for every change in the window.
 */
function workMixType(subject: string): WorkMixType {
  const match = /^([a-z]+)(\([^)]*\))?!?:/.exec(subject.trim());
  const type = match?.[1];
  return (WORK_MIX_TYPES as readonly string[]).includes(type ?? '')
    ? (type as WorkMixType)
    : 'other';
}

/**
 * A merge commit's subject is git's ("Merge pull request #12 from ...") and carries no type, so a change
 * merged that way takes the most common type among its branch commits, ties going to the earliest. A
 * telemetry record commit is not the work and does not vote. Anything else reads its own subject.
 */
function changeWorkMixType(fact: ChangeFacts): WorkMixType {
  const own = workMixType(fact.change.subject);
  if (own !== 'other' || fact.branchSubjects.length === 0) {
    return own;
  }
  const votes = new Map<WorkMixType, number>();
  for (const subject of fact.branchSubjects) {
    if (/^chore\(telemetry\): record /.test(subject)) {
      continue;
    }
    const type = workMixType(subject);
    if (type !== 'other') {
      votes.set(type, (votes.get(type) ?? 0) + 1);
    }
  }
  let best: WorkMixType = 'other';
  let bestCount = 0;
  for (const [type, count] of votes) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Flow efficiency: how much of a change's elapsed cycle time anyone was actually working on it. Active
 * seconds are the agent's run time plus the operator's active time across the change's sessions, which is
 * why a change with no sessions, no timing, or no active figures is excluded by reason rather than read as
 * nought per cent busy.
 *
 * A value above one is reported as it stands. It means the sessions overlapped the cycle window or ran
 * either side of it, and rounding it down to one would hide that the figures disagree.
 */
function computeFlowEfficiency(
  facts: ChangeFacts[],
  sessions: Map<string, SessionRecord>,
): Distribution & { outsideSeconds: number; note: string } {
  let outsideSeconds = 0;
  const distribution = distributionOf(
    facts.map((fact) => {
      const cycle = fact.timing.cycleTimeSeconds;
      const first = fact.timing.firstAuthoredAt;
      if (cycle === null || cycle <= 0 || first === null) {
        return { value: null, cite: fact.change.id, reason: 'no-timing' };
      }
      const ids = fact.sessions.sessions;
      if (ids.length === 0) {
        return { value: null, cite: fact.change.id, reason: 'no-sessions' };
      }
      const windowStart = Date.parse(first);
      const windowEnd = Date.parse(fact.change.mergeTime);
      let inside = 0;
      let sawFigure = false;
      for (const id of ids) {
        const file = sessions.get(id)?.file;
        if (!file) {
          continue;
        }
        const active =
          (file.agentRunSeconds > 0 ? file.agentRunSeconds : 0) +
          (typeof file.operatorActiveSeconds === 'number'
            ? file.operatorActiveSeconds
            : 0);
        if (active <= 0) {
          continue;
        }
        sawFigure = true;
        // A record holds totals, not a timeline, so active time is spread evenly over the session's own
        // window and only the part overlapping the cycle window counts; the rest is reported apart.
        const start = Date.parse(file.startedAt);
        const end = Date.parse(file.endedAt);
        const span = Math.max(1, end - start);
        const overlap = Math.max(
          0,
          Math.min(end, windowEnd) - Math.max(start, windowStart),
        );
        const share = Number.isNaN(span) ? 1 : Math.min(1, overlap / span);
        inside += active * share;
        outsideSeconds += active * (1 - share);
      }
      if (!sawFigure) {
        return {
          value: null,
          cite: fact.change.id,
          reason: 'no-active-seconds',
        };
      }
      return { value: Math.min(1, inside / cycle), cite: fact.change.id };
    }),
  );
  return {
    ...distribution,
    outsideSeconds: Math.round(outsideSeconds),
    note: "active seconds inside the cycle window over cycle seconds; a session's active time is spread over its own window and the part outside the cycle is reported as worked outside the window",
  };
}

/**
 * The operator dimension. Agent operators come from the provider and model already on every record, and
 * take their currency from the subscription allocation rather than from a reported cost, because a
 * subscription session reports none. Human operators come from the pseudonymous `operatorId` and are
 * measured in hours alone.
 *
 * Two populations are excluded rather than counted as zero hours, in the same shape every other exclusion
 * in this file uses: a change declaring `Session: none` is human work whose hours no record holds, and a
 * session recorded before operator capture was enabled carries no identifier to key on.
 */
function computeOperators(
  facts: ChangeFacts[],
  sessions: Map<string, SessionRecord>,
  allocation: Allocation,
): Operators {
  const operators: Operators = {
    trust: ['reported', 'allocated'],
    agents: {},
    humans: {},
    excluded: { humanOnly: 0, noOperator: 0, invalidSession: 0 },
  };
  for (const fact of facts) {
    if (fact.sessions.status === 'human-only') {
      operators.excluded.humanOnly += 1;
    }
    for (const id of fact.sessions.sessions) {
      const record = sessions.get(id);
      if (!record?.file) {
        operators.excluded.invalidSession += 1;
        continue;
      }
      const file = record.file;

      const key = `${file.provider}/${file.model}`;
      const agent = (operators.agents[key] ??= {
        provider: file.provider,
        model: file.model,
        currencies: {},
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        sessions: 0,
        provisional: false,
        cites: [],
      });
      agent.sessions += 1;
      agent.cites.push(record.path);
      // Tokens are a reported figure and stay absent when the harness supplied none; the allocated share
      // does not depend on them, so a record with missing figures still carries its currency here.
      if (!file.figuresMissing) {
        agent.inputTokens += file.inputTokens;
        agent.outputTokens += file.outputTokens;
        agent.cachedTokens += file.cachedTokens;
      }
      const share = allocation.bySession[id];
      if (share) {
        const currency = (agent.currencies[share.currency] ??= {
          amount: 0,
          overage: 0,
        });
        currency.amount += share.amount;
        currency.overage += share.overage;
        agent.provisional ||= share.provisional;
      }

      // Hours, never money. `operatorActiveSeconds` is absent on every record written before cost
      // allocation was enabled, and those are counted rather than read as an operator working no hours.
      if (typeof file.operatorActiveSeconds !== 'number') {
        operators.excluded.noOperator += 1;
        continue;
      }
      // Hours were measured but no identifier was configured: they stay on the page under one label rather
      // than vanishing, and the label says the identifier is missing, not that nobody was there.
      const humanKey =
        typeof file.operatorId === 'string'
          ? file.operatorId
          : '(no operator identifier)';
      const human = (operators.humans[humanKey] ??= {
        hours: 0,
        sessions: 0,
        cites: [],
      });
      human.hours += file.operatorActiveSeconds / 3600;
      human.sessions += 1;
      human.cites.push(record.path);
    }
  }
  return operators;
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
      rate: {
        amount: 0,
        currency,
        inputOutputTokens: 0,
        cachedTokens: 0,
        perMillionInputOutput: null,
        perMillionCached: null,
        sessions: 0,
        withoutFigures: 0,
        provisional: false,
        cites: [],
      },
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
      // The rate divides this session's share by the tokens this session reported. A share whose record
      // carries no figures still counts toward the amount, so it is counted here rather than quietly
      // shrinking the denominator without saying so.
      into.rate.amount += share.amount + share.overage;
      into.rate.sessions += 1;
      into.rate.provisional ||= share.provisional;
      into.rate.cites.push(record.path);
      if (record.file.figuresMissing) {
        into.rate.withoutFigures += 1;
      } else {
        into.rate.inputOutputTokens +=
          record.file.inputTokens + record.file.outputTokens;
        into.rate.cachedTokens += record.file.cachedTokens;
      }
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
  // The rate is a division, done once the sums are final. No tokens means no rate: null says the figure
  // could not be computed, where a zero would claim the tokens were free.
  for (const into of Object.values(allocation.currencies)) {
    const per = (tokens: number) =>
      tokens > 0
        ? Math.round((into.rate.amount / tokens) * 1e6 * 1e4) / 1e4
        : null;
    into.rate.perMillionInputOutput = per(into.rate.inputOutputTokens);
    into.rate.perMillionCached = per(into.rate.cachedTokens);
  }

  return allocation;
}

export function computeSignals(
  allFacts: ChangeFacts[],
  sessions: Map<string, SessionRecord>,
  allUnmerged: UnmergedPullRequest[],
  releases: ReleaseSummary[],
  subscriptions: SubscriptionRecord[],
  thresholds: Thresholds,
  reworkIgnore: string[],
  configAt: (change: Change) => TelemetryConfig,
  now: string,
  declared: { measuredFrom: string | null; closedPullRequests: number[] } = {
    measuredFrom: null,
    closedPullRequests: [],
  },
): RepositorySignals {
  // Changes merged before the instrumentation existed are excluded with that reason, not measured as
  // gaps; a pull request an operator declared closed leaves the queue, because git cannot see closed.
  const fromMs = declared.measuredFrom
    ? Date.parse(declared.measuredFrom)
    : null;
  const facts =
    fromMs === null
      ? allFacts
      : allFacts.filter((fact) => Date.parse(fact.change.mergeTime) >= fromMs);
  const closed = new Set(declared.closedPullRequests);
  const unmerged = allUnmerged.filter((entry) => !closed.has(entry.number));
  const boundary: RepositorySignals['boundary'] = {
    measuredFrom: declared.measuredFrom,
    preInstrumentation: allFacts.length - facts.length,
    declaredClosed: allUnmerged
      .filter((entry) => closed.has(entry.number))
      .map((entry) => entry.number),
    note: 'changes merged before measuredFrom predate the instrumentation and are excluded with that reason; a pull request declared closed in the registry leaves the queue',
  };
  const allocation = computeAllocation(facts, sessions, subscriptions, now);
  const operators = computeOperators(facts, sessions, allocation);
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
  const rework: RepositorySignals['rework'] = {
    windowDays,
    pairs: [],
    ignore: reworkIgnore,
    ignored: 0,
  };
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
      const sharedAll = laterFact.files.filter(
        (file) =>
          earlierFact.files.includes(file) && !file.startsWith('.telemetry/'),
      );
      const shared = sharedAll.filter(
        (file) => !reworkIgnore.some((glob) => matchesGlob(file, glob)),
      );
      // A pair whose every shared file is ignored is not a pair. It is counted so the read can say how much
      // of the rework signal was lockfile and generated-file churn rather than work done twice.
      if (sharedAll.length > 0 && shared.length === 0) {
        rework.ignored += 1;
      }
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
    perMergedChange: emptyCostPer(),
    perReleasedChange: emptyCostPer(),
    perRelease: emptyCostPer(),
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
      allocated: number;
      currency: string | null;
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
      ['tasks', true, fact.tasks.length > 0 ? fact.tasks.length : null],
      [
        'taskComplexity',
        true,
        fact.tasks.length > 0
          ? fact.tasks.reduce((sum, task) => sum + (task.weight ?? 1), 0)
          : null,
      ],
    ];
    for (const [unit, enabled, value] of units) {
      if (!enabled) {
        continue;
      }
      const accumulator = (effortAccumulators[unit] ??= {
        unit,
        cost: 0,
        allocated: 0,
        currency: null as string | null,
        units: 0,
        changes: 0,
        excluded: 0,
        cites: [],
      });
      if (complete && value !== null && value > 0) {
        accumulator.cost += changeSpend.costUsd;
        for (const [currency, aggregates] of Object.entries(
          allocation.currencies,
        )) {
          const share = aggregates.byChange[fact.change.id];
          if (share) {
            accumulator.allocated += share.amount + share.overage;
            accumulator.currency ??= currency;
          }
        }
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
      allocatedPerUnit:
        accumulator.units > 0 && accumulator.allocated > 0
          ? Math.round((accumulator.allocated / accumulator.units) * 1e6) / 1e6
          : null,
      currency: accumulator.currency,
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
        tasks: 0,
        complexity: 0,
        unweightedTasks: 0,
        storyPoints: 0,
        withoutPoints: 0,
        changes: 0,
        costUsd: 0,
        sessions: 0,
        cites: [],
      });
    }
    for (const fact of facts) {
      const bucket = weeklyMap.get(weekOf(fact.change.mergeTime))!;
      bucket.changes += 1;
      for (const task of fact.tasks) {
        bucket.tasks += 1;
        bucket.complexity += task.weight ?? 1;
        if (task.weight === null) {
          bucket.unweightedTasks += 1;
        }
      }
      const points = numberOr(fact.change.trailers['Story-Points']);
      if (points === null) {
        bucket.withoutPoints += 1;
      } else {
        bucket.storyPoints += points;
      }
      bucket.cites.push(fact.change.id);
      const changeSpend = spend.byChange[fact.change.id];
      if (changeSpend) {
        bucket.costUsd =
          Math.round((bucket.costUsd + changeSpend.costUsd) * 1e6) / 1e6;
        bucket.sessions += changeSpend.sessions;
      }
    }
  }
  const weekly = [...weeklyMap.values()];
  const velocityPoints = weekly.reduce(
    (sum, week) => sum + week.storyPoints,
    0,
  );
  const velocityChanges = weekly.reduce((sum, week) => sum + week.changes, 0);
  const withoutPoints = weekly.reduce(
    (sum, week) => sum + week.withoutPoints,
    0,
  );
  const velocityTasks = weekly.reduce((sum, week) => sum + week.tasks, 0);
  const velocityComplexity = weekly.reduce(
    (sum, week) => sum + week.complexity,
    0,
  );
  const velocityUnweighted = weekly.reduce(
    (sum, week) => sum + week.unweightedTasks,
    0,
  );
  const velocity: Velocity = {
    trust: ['observed'],
    weeks: weekly.length,
    tasks: velocityTasks,
    complexity: velocityComplexity,
    unweightedTasks: velocityUnweighted,
    complexityPerWeek:
      weekly.length > 0
        ? Math.round((velocityComplexity / weekly.length) * 100) / 100
        : null,
    tasksPerWeek:
      weekly.length > 0
        ? Math.round((velocityTasks / weekly.length) * 100) / 100
        : null,
    storyPoints: velocityPoints,
    changes: velocityChanges,
    // No weeks means no rate. A zero would claim nothing shipped over a window that does not exist.
    pointsPerWeek:
      weekly.length > 0
        ? Math.round((velocityPoints / weekly.length) * 100) / 100
        : null,
    changesPerWeek:
      weekly.length > 0
        ? Math.round((velocityChanges / weekly.length) * 100) / 100
        : null,
    excludedWithoutPoints: withoutPoints,
    note: "relative complexity of the OpenSpec tasks completed per week, read from each change's task list; an unweighted task counts one and is stated; story points and changes per week sit beside it",
  };
  const trends = {
    weekly,
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

  // Cost per merged change, per released change, and per release. On a subscription every reported cost is
  // zero by rule, so a currency figure would be a lie; the read says tokens instead and labels itself.
  const releasedChangeIds = new Set(
    releases.flatMap((release) => release.changes),
  );
  const costPer = (ids: Set<string> | null, units: number): CostPer => {
    const figure = emptyCostPer();
    let anyCost = false;
    for (const fact of facts) {
      if (ids !== null && !ids.has(fact.change.id)) {
        continue;
      }
      const changeSpend = spend.byChange[fact.change.id];
      if (!changeSpend || changeSpend.sessions === 0) {
        figure.excluded += 1;
        continue;
      }
      figure.count += 1;
      figure.tokens += changeSpend.inputTokens + changeSpend.outputTokens;
      figure.costUsd = (figure.costUsd ?? 0) + changeSpend.costUsd;
      if (changeSpend.costUsd > 0) {
        anyCost = true;
      }
      for (const [currency, aggregates] of Object.entries(
        allocation.currencies,
      )) {
        const share = aggregates.byChange[fact.change.id];
        if (share) {
          figure.allocated =
            (figure.allocated ?? 0) + share.amount + share.overage;
          figure.currency ??= currency;
        }
      }
    }
    const divisor = units > 0 ? units : figure.count;
    if (divisor > 0 && figure.costUsd !== null) {
      figure.costUsd = Math.round((figure.costUsd / divisor) * 1e6) / 1e6;
      figure.tokens = Math.round(figure.tokens / divisor);
    }
    if (divisor > 0 && figure.allocated !== null) {
      figure.allocated = Math.round((figure.allocated / divisor) * 1e6) / 1e6;
    }
    // Every contributing session reported no cost, which on a subscription is the rule rather than a gap.
    figure.tokensOnly = !anyCost;
    return figure;
  };
  spend.perMergedChange = costPer(null, 0);
  spend.perReleasedChange = costPer(releasedChangeIds, 0);
  spend.perRelease = costPer(releasedChangeIds, releases.length);

  // The metered rate: reported cost over reported tokens, per provider and currency. A subscription session
  // contributes nothing here — its cost is fixed at zero and its rate lives in the allocation.
  const meteredByKey = new Map<string, MeteredRate>();
  for (const fact of facts) {
    for (const id of fact.sessions.sessions) {
      const record = sessions.get(id);
      const file = record?.file;
      if (!file || file.billingKind !== 'metered') {
        continue;
      }
      const currency = file.cost?.currency ?? 'USD';
      const amount = file.cost?.amount ?? file.costUsd;
      const key = `${file.provider}/${currency}`;
      const fresh: MeteredRate = {
        provider: file.provider,
        currency,
        amount: 0,
        inputOutputTokens: 0,
        cachedTokens: 0,
        cacheComponentsUnknown: false,
        perMillionInputOutput: null,
        sessions: 0,
        withoutTokens: 0,
        trust: ['reported'],
        cites: [],
      };
      const rate =
        meteredByKey.get(key) ?? meteredByKey.set(key, fresh).get(key)!;
      rate.sessions += 1;
      rate.cites.push(record!.path);
      rate.amount = Math.round((rate.amount + amount) * 1e6) / 1e6;
      if (file.figuresMissing) {
        rate.withoutTokens += 1;
        continue;
      }
      rate.inputOutputTokens += file.inputTokens + file.outputTokens;
      rate.cachedTokens += file.cachedTokens;
      // A record carrying only the combined figure cannot say how much was read and how much written, and
      // any cache figure including it has to say so rather than imply a split it does not have.
      if (
        file.cacheReadTokens === undefined &&
        file.cacheWriteTokens === undefined &&
        file.cachedTokens > 0
      ) {
        rate.cacheComponentsUnknown = true;
      }
    }
  }
  const meteredRates = [...meteredByKey.values()]
    .map((rate) => ({
      ...rate,
      perMillionInputOutput:
        rate.inputOutputTokens > 0
          ? Math.round((rate.amount / rate.inputOutputTokens) * 1e6 * 1e4) / 1e4
          : null,
    }))
    .sort((a, b) =>
      `${a.provider}/${a.currency}`.localeCompare(
        `${b.provider}/${b.currency}`,
      ),
    );

  // --- Work mix, flow efficiency, iterations, abandonment, spec lead time, check compliance -------------

  // Work mix: what each week actually shipped, by the conventional type on the change's subject. A week of
  // fixes and a week of features are the same count and a different story.
  const workMixWeekly: Record<string, Record<string, WorkMixEntry>> = {};
  for (const week of weekly) {
    workMixWeekly[week.week] = {};
  }
  for (const fact of facts) {
    const week = weekOf(fact.change.mergeTime);
    const bucket = (workMixWeekly[week] ??= {});
    const type = changeWorkMixType(fact);
    const entry = (bucket[type] ??= { changes: 0, costUsd: 0, cites: [] });
    entry.changes += 1;
    entry.cites.push(fact.change.id);
    const changeSpend = spend.byChange[fact.change.id];
    if (changeSpend) {
      entry.costUsd =
        Math.round((entry.costUsd + changeSpend.costUsd) * 1e6) / 1e6;
    }
  }
  const workMix = {
    weekly: workMixWeekly,
    note: "conventional commit type on the change subject, or the most common type among a merge commit's branch commits; other covers a subject that does not parse",
  };

  const flowEfficiency = computeFlowEfficiency(facts, sessions);

  const iterations = {
    sessionsPerChange: distributionOf(
      facts.map((fact) => ({
        value: fact.sessions.sessions.length,
        cite: fact.change.id,
      })),
    ),
    commitsPerChange: distributionOf(
      facts.map((fact) => ({
        value: fact.change.branchCommits.length || 1,
        cite: fact.change.id,
      })),
    ),
  };

  // Abandonment: what the queue costs once a pull head has sat past the registered age. Reported as older
  // than that age, never as closed, because git does not say whether a pull request was closed.
  const abandonedAfterSeconds = thresholds.abandonedAfterSeconds ?? 30 * 86_400;
  const abandonment: Abandonment = {
    afterSeconds: abandonedAfterSeconds,
    count: 0,
    costUsd: 0,
    tokens: 0,
    withoutFigures: 0,
    trust: ['observed', 'reported'],
    cites: [],
  };
  for (const entry of unmerged) {
    // A pull head with no oldest commit has no age to compare, so it is not reported as old.
    if (!entry.oldestCommitAt) {
      continue;
    }
    const age = (nowMs - Date.parse(entry.oldestCommitAt)) / 1000;
    if (!Number.isFinite(age) || age < abandonedAfterSeconds) {
      continue;
    }
    abandonment.count += 1;
    abandonment.cites.push(String(entry.number));
    const perPull = spend.perUnmergedPullRequest[String(entry.number)];
    if (perPull) {
      abandonment.costUsd =
        Math.round((abandonment.costUsd + perPull.spend.costUsd) * 1e6) / 1e6;
      abandonment.tokens +=
        perPull.spend.inputTokens + perPull.spend.outputTokens;
      abandonment.withoutFigures += perPull.missingFigures;
    }
  }

  // Spec lead time: an idea's whole life, from the first commit that cited the spec to the merge that
  // archived it. A spec still open has no end yet, and one whose changes have no pull head timing has no
  // start we trust; both are excluded by reason rather than guessed.
  const specFirstCommit = new Map<string, string>();
  const specArchiveMerge = new Map<string, string>();
  const specUntimed = new Set<string>();
  for (const fact of facts) {
    const spec =
      typeof fact.change.trailers.Spec === 'string'
        ? fact.change.trailers.Spec
        : null;
    if (spec) {
      const start = fact.timing.firstAuthoredAt;
      if (start === null) {
        specUntimed.add(spec);
      } else {
        const known = specFirstCommit.get(spec);
        if (known === undefined || Date.parse(start) < Date.parse(known)) {
          specFirstCommit.set(spec, start);
        }
      }
    }
    // The proposal file's first appearance is the earliest observed moment the idea existed, and it
    // predates any trailer; the earlier of the two starts the clock.
    for (const file of fact.files) {
      const proposed = /^openspec\/changes\/([a-z0-9-]+)\/proposal\.md$/.exec(
        file,
      );
      if (proposed) {
        const name = proposed[1];
        const at = fact.timing.firstAuthoredAt ?? fact.change.mergeTime;
        const known = specFirstCommit.get(name);
        if (known === undefined || Date.parse(at) < Date.parse(known)) {
          specFirstCommit.set(name, at);
        }
        specUntimed.delete(name);
      }
    }
    // The change that archives a spec is the one that writes its archived directory.
    for (const file of fact.files) {
      const archived =
        /openspec\/changes\/archive\/[0-9-]+-([a-z0-9-]+)\//.exec(file);
      if (archived) {
        const name = archived[1];
        const known = specArchiveMerge.get(name);
        if (
          known === undefined ||
          Date.parse(fact.change.mergeTime) < Date.parse(known)
        ) {
          specArchiveMerge.set(name, fact.change.mergeTime);
        }
      }
    }
  }
  const specLeadTime = distributionOf(
    [...new Set([...specFirstCommit.keys(), ...specUntimed])]
      .sort()
      .map((spec) => {
        if (specUntimed.has(spec) && !specFirstCommit.has(spec)) {
          return { value: null, cite: spec, reason: 'untimed' };
        }
        const archived = specArchiveMerge.get(spec);
        if (archived === undefined) {
          return { value: null, cite: spec, reason: 'open' };
        }
        const start = specFirstCommit.get(spec)!;
        return {
          value: (Date.parse(archived) - Date.parse(start)) / 1000,
          cite: spec,
        };
      }),
  );

  // Check compliance: how often a change recorded a local check at all, and how often it passed. The share
  // matters more than the rate: a high pass rate over a tenth of the changes says very little.
  const recordedOutcomes = Object.values(localChecks).reduce(
    (sum, value) => sum + value,
    0,
  );
  const passedOutcomes = localChecks.passed ?? 0;
  const checkCompliance: CheckCompliance = {
    recorded: recordedOutcomes,
    changes: facts.length,
    recordedShare:
      facts.length > 0
        ? Math.round((recordedOutcomes / facts.length) * 1e4) / 1e4
        : null,
    passed: passedOutcomes,
    passRate:
      recordedOutcomes > 0
        ? Math.round((passedOutcomes / recordedOutcomes) * 1e4) / 1e4
        : null,
    trust: ['reported'],
  };

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
    velocity,
    workMix,
    flowEfficiency,
    iterations,
    abandonment,
    specLeadTime,
    checkCompliance,
    meteredRates,
    costClasses,
    operators,
    coverage,
    allocation,
    boundary,
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
