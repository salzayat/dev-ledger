import type { TelemetryConfig } from './config.ts';

// One file per work session, written by the harness hook at session end and committed with the work.

export const SESSION_SCHEMA_VERSION = 1;
export const SESSIONS_PATH = '.telemetry/sessions';
export const IDLE_CAP_ALGORITHM = 'idle-cap-v1';
export const ATTRIBUTION_ALGORITHM = 'prompt-attribution-v1';

export type BillingKind = 'metered' | 'subscription';
export type CheckOutcome = 'passed' | 'failed' | 'not-run';

export type SessionFile = {
  schemaVersion: number;
  sessionId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  /** Cache reads, when the harness reports them apart from writes. */
  cacheReadTokens?: number;
  /** Cache writes, when the harness reports them; absent is unknown, never zero. */
  cacheWriteTokens?: number;
  /** The reported cost with its currency, for a provider not billing in USD. */
  cost?: { amount: number; currency: string };
  costUsd: number;
  notionalCostUsd?: number;
  figuresSource: string;
  figuresMissing?: boolean;
  startedAt: string;
  endedAt: string;
  wallClockSeconds: number;
  agentRunSeconds: number;
  billingKind: BillingKind;
  subscriptionId?: string;
  branch: string;
  commits: string[];
  spec?: string;
  localCheck: { outcome: CheckOutcome; command: string };
  costClass?: string;
  operatorActiveSeconds?: number;
  operatorActiveAlgorithm?: string;
  agentAutonomousSeconds?: number;
  idleSeconds?: number;
  operatorId?: string | null;
  corrects?: string;
};

const FORBIDDEN_SESSION_KEYS =
  /^(name|operatorName|email|operatorEmail|hourlyRate|rate|salary|compensation|userName|user)$/i;

/** The path of a session file relative to the repository root. */
export function sessionFilePath(sessionId: string, endedAt: string): string {
  const month = endedAt.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`endedAt must be an ISO 8601 timestamp, got "${endedAt}"`);
  }
  return `${SESSIONS_PATH}/${month}/${sessionId}.json`;
}

export type TimeAttribution = {
  /** Man hours, in seconds: time a person was working the thread. */
  operatorActiveSeconds: number;
  /** Time the agent was producing on its own, with no person required. */
  agentAutonomousSeconds: number;
  /** Time the thread sat open with nobody in it. */
  idleSeconds: number;
};

/**
 * Splits the span between an operator's first and last prompt into three, from timestamps alone.
 *
 * Between one prompt and the next, the agent works first and the person works last: the agent runs until
 * its final record in that gap, then the person reads what came back, thinks, and types. So the span up to
 * that last agent record is autonomous, and the tail after it belongs to the operator — up to the idle cap,
 * beyond which the thread was simply left open and the remainder is idle.
 *
 * The three sum to the span, which is what makes the figure checkable. Capping the whole gap instead, with
 * no notion of who was producing, charges an unattended agent run to the person: over this repository's own
 * transcripts that reads about 1.75 times the man hours actually worked.
 */
export function attributeTranscriptTime(
  events: { timestamp: string; kind: 'prompt' | 'agent' }[],
  idleCapSeconds: number,
): TimeAttribution {
  const at = (value: string) => Date.parse(value);
  const ordered = events
    .filter((event) => !Number.isNaN(at(event.timestamp)))
    .sort((a, b) => at(a.timestamp) - at(b.timestamp));
  const prompts = ordered.filter((event) => event.kind === 'prompt');
  const attribution: TimeAttribution = {
    operatorActiveSeconds: 0,
    agentAutonomousSeconds: 0,
    idleSeconds: 0,
  };
  for (let index = 1; index < prompts.length; index += 1) {
    const from = at(prompts[index - 1].timestamp);
    const to = at(prompts[index].timestamp);
    let lastAgent = from;
    for (const event of ordered) {
      const when = at(event.timestamp);
      if (event.kind === 'agent' && when > from && when <= to) {
        lastAgent = Math.max(lastAgent, when);
      }
    }
    const autonomous = (lastAgent - from) / 1000;
    const tail = (to - lastAgent) / 1000;
    const working = Math.min(tail, idleCapSeconds);
    attribution.agentAutonomousSeconds += autonomous;
    attribution.operatorActiveSeconds += working;
    attribution.idleSeconds += tail - working;
  }
  attribution.operatorActiveSeconds = Math.round(
    attribution.operatorActiveSeconds,
  );
  attribution.agentAutonomousSeconds = Math.round(
    attribution.agentAutonomousSeconds,
  );
  attribution.idleSeconds = Math.round(attribution.idleSeconds);
  return attribution;
}

/**
 * Agent run seconds from transcript timestamps: each turn runs from its prompt (or, for work already under
 * way, the first record in the window) to the last agent record before the next prompt, the session's final
 * turn included. A gap between two records of one turn longer than the idle cap counts as the cap, because
 * the agent was waiting on someone, for a permission or an answer, rather than executing. One prompt is
 * enough; a window with no agent record leaves the figure absent.
 */
export function computeAgentRunSeconds(
  events: { timestamp: string; kind: 'prompt' | 'agent' }[],
  idleCapSeconds: number,
): number | undefined {
  const at = (value: string) => Date.parse(value);
  const ordered = events
    .filter((event) => !Number.isNaN(at(event.timestamp)))
    .sort((a, b) => at(a.timestamp) - at(b.timestamp));
  if (!ordered.some((event) => event.kind === 'agent')) {
    return undefined;
  }
  let total = 0;
  let previous: number | null = null;
  for (const event of ordered) {
    const when = at(event.timestamp);
    if (event.kind === 'prompt') {
      previous = when;
      continue;
    }
    if (previous !== null) {
      total += Math.min((when - previous) / 1000, idleCapSeconds);
    }
    previous = when;
  }
  return Math.round(total);
}

/**
 * Operator active seconds: the sum of gaps between the operator's own events, each gap capped at the
 * idle cap. A single event contributes nothing; the figure is about engagement between events.
 */
export function computeOperatorActiveSeconds(
  eventTimes: string[],
  idleCapSeconds: number,
): number {
  const times = eventTimes
    .map((value) => Date.parse(value))
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b);
  let total = 0;
  for (let index = 1; index < times.length; index += 1) {
    const gap = (times[index] - times[index - 1]) / 1000;
    total += Math.min(gap, idleCapSeconds);
  }
  return Math.round(total);
}

/** Validates a parsed session file against the schema and the configuration. */
export function validateSessionFile(
  value: unknown,
  config: TelemetryConfig,
): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['session file must be a JSON object'];
  }
  const file = value as Record<string, unknown>;
  for (const key of Object.keys(file)) {
    if (FORBIDDEN_SESSION_KEYS.test(key)) {
      errors.push(
        `${key} is not allowed: a session file carries no name, email address, or rate`,
      );
    }
  }
  if (file.schemaVersion !== SESSION_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SESSION_SCHEMA_VERSION}`);
  }
  for (const key of [
    'sessionId',
    'provider',
    'model',
    'figuresSource',
    'startedAt',
    'endedAt',
    'branch',
  ]) {
    if (typeof file[key] !== 'string' || (file[key] as string).length === 0) {
      errors.push(`${key} must be a non-empty string`);
    }
  }
  for (const key of ['inputTokens', 'outputTokens', 'cachedTokens']) {
    if (!Number.isInteger(file[key]) || (file[key] as number) < 0) {
      errors.push(`${key} must be a non-negative integer`);
    }
  }
  for (const key of ['costUsd', 'wallClockSeconds', 'agentRunSeconds']) {
    if (
      typeof file[key] !== 'number' ||
      !Number.isFinite(file[key] as number) ||
      (file[key] as number) < 0
    ) {
      errors.push(`${key} must be a non-negative number`);
    }
  }
  if (
    file.notionalCostUsd !== undefined &&
    (typeof file.notionalCostUsd !== 'number' || file.notionalCostUsd < 0)
  ) {
    errors.push('notionalCostUsd must be a non-negative number when present');
  }
  if (file.figuresMissing !== undefined && file.figuresMissing !== true) {
    errors.push('figuresMissing may only be true, or absent');
  }
  if (file.billingKind !== 'metered' && file.billingKind !== 'subscription') {
    errors.push('billingKind must be metered or subscription');
  }
  if (file.billingKind === 'subscription') {
    if (file.costUsd !== 0) {
      errors.push(
        'costUsd must be 0 for a subscription session; a pay-per-token equivalent belongs in notionalCostUsd',
      );
    }
    if (
      typeof file.subscriptionId !== 'string' ||
      file.subscriptionId.length === 0
    ) {
      errors.push('subscriptionId is required for a subscription session');
    }
  }
  if (
    !Array.isArray(file.commits) ||
    !file.commits.every((commit) => typeof commit === 'string')
  ) {
    errors.push('commits must be an array of commit identifiers');
  }
  if (
    file.spec !== undefined &&
    (typeof file.spec !== 'string' ||
      !new RegExp(config.specPattern).test(file.spec))
  ) {
    errors.push(`spec must match the configured pattern ${config.specPattern}`);
  }
  const check = file.localCheck as Record<string, unknown> | undefined;
  if (typeof check !== 'object' || check === null) {
    errors.push('localCheck is required');
  } else {
    if (!['passed', 'failed', 'not-run'].includes(check.outcome as string)) {
      errors.push('localCheck.outcome must be passed, failed, or not-run');
    }
    if (typeof check.command !== 'string') {
      errors.push('localCheck.command must be a string');
    }
  }
  if (file.costClass !== undefined) {
    if (!config.costAllocation.enabled) {
      errors.push('costClass is present but cost allocation is disabled');
    } else if (
      !config.costAllocation.costClasses.includes(file.costClass as string)
    ) {
      errors.push(
        `costClass must be one of ${config.costAllocation.costClasses.join(', ')}`,
      );
    }
  }
  const operatorFields = [
    'operatorActiveSeconds',
    'operatorActiveAlgorithm',
    'operatorId',
  ].filter((key) => file[key] !== undefined);
  if (!config.costAllocation.enabled && operatorFields.length > 0) {
    errors.push(
      `${operatorFields.join(', ')} must be absent when cost allocation is disabled`,
    );
  }
  // A currency-named cost may accompany the historical field, but not disagree with it: two costs for one
  // session would leave every read choosing between them.
  if (file.cost !== undefined) {
    const cost = file.cost as Record<string, unknown>;
    if (
      typeof cost !== 'object' ||
      cost === null ||
      typeof cost.amount !== 'number' ||
      !Number.isFinite(cost.amount) ||
      cost.amount < 0
    ) {
      errors.push('cost.amount must be a non-negative number');
    }
    if (
      typeof cost.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(cost.currency)
    ) {
      errors.push('cost.currency must be an ISO 4217 code in upper case');
    }
    if (
      typeof cost.amount === 'number' &&
      cost.currency === 'USD' &&
      typeof file.costUsd === 'number' &&
      cost.amount !== file.costUsd
    ) {
      errors.push(
        'cost.amount and costUsd disagree; a session reports one cost, not two',
      );
    }
  }
  for (const key of ['cacheReadTokens', 'cacheWriteTokens'] as const) {
    const value = file[key];
    if (
      value !== undefined &&
      (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    ) {
      errors.push(`${key} must be a non-negative integer when present`);
    }
  }
  if (config.costAllocation.enabled) {
    // Absence is counted by the reads, not rejected here. A harness that cannot supply the figure — every
    // harness before this was derived, and any transcript with fewer than two prompts — writes a record of
    // work whose operator time is unknown, which is the same class of fact as `figuresMissing` and is
    // handled the same way: excluded and counted, never zero and never fatal. A figure that is present and
    // malformed is still an error.
    if (
      file.operatorActiveSeconds !== undefined &&
      (typeof file.operatorActiveSeconds !== 'number' ||
        file.operatorActiveSeconds < 0)
    ) {
      errors.push(
        'operatorActiveSeconds must be a non-negative number when present',
      );
    }
    if (
      file.operatorActiveAlgorithm !== undefined &&
      typeof file.operatorActiveAlgorithm !== 'string'
    ) {
      errors.push(
        'operatorActiveAlgorithm must name the algorithm when present',
      );
    }
    if (file.operatorId !== null && file.operatorId !== undefined) {
      if (
        typeof file.operatorId !== 'string' ||
        !config.costAllocation.operators.includes(file.operatorId)
      ) {
        errors.push(
          'operatorId must be a declared pseudonymous identifier, or null when missing',
        );
      }
    }
  }
  return errors;
}

export type SessionInput = {
  sessionId: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cost?: { amount: number; currency: string };
  costUsd?: number;
  notionalCostUsd?: number;
  figuresSource: string;
  /** Omitted, the start is the clock `session start` recorded and the end is when `session end` ran. */
  startedAt?: string;
  endedAt?: string;
  billingKind: BillingKind;
  subscriptionId?: string;
  branch: string;
  commits: string[];
  spec?: string;
  localCheck: { outcome: CheckOutcome; command: string };
  costClass?: string;
  agentRunSeconds?: number;
  operatorEvents?: string[];
  operatorActiveSeconds?: number;
  operatorActiveAlgorithm?: string;
  agentAutonomousSeconds?: number;
  idleSeconds?: number;
  operatorId?: string | null;
  corrects?: string;
};

/** Builds a session file from the harness's figures, applying the configuration's allocation rules. */
export function buildSessionFile(
  input: SessionInput,
  config: TelemetryConfig,
): SessionFile {
  const startedAt = input.startedAt ?? '';
  const endedAt = input.endedAt ?? '';
  const wallClockSeconds = Math.max(
    0,
    Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000) || 0,
  );
  const figuresMissing =
    input.inputTokens === undefined ||
    input.outputTokens === undefined ||
    (input.billingKind === 'metered' && input.costUsd === undefined);
  const file: SessionFile = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId: input.sessionId,
    provider: input.provider,
    model: input.model,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    cachedTokens: input.cachedTokens ?? 0,
    costUsd: input.billingKind === 'subscription' ? 0 : (input.costUsd ?? 0),
    figuresSource: input.figuresSource,
    startedAt,
    endedAt,
    wallClockSeconds,
    agentRunSeconds: input.agentRunSeconds ?? 0,
    billingKind: input.billingKind,
    branch: input.branch,
    commits: input.commits,
    localCheck: input.localCheck,
  };
  if (figuresMissing) {
    file.figuresMissing = true;
  }
  // Cache reads and writes travel apart when the harness reports them apart. A provider that reports only
  // hits records only hits: writing a zero for the other would claim it wrote nothing, which is a reading
  // it never made.
  if (input.cacheReadTokens !== undefined) {
    file.cacheReadTokens = input.cacheReadTokens;
  }
  if (input.cacheWriteTokens !== undefined) {
    file.cacheWriteTokens = input.cacheWriteTokens;
  }
  if (input.cost !== undefined) {
    file.cost = input.cost;
  }
  if (input.billingKind === 'subscription') {
    file.subscriptionId = input.subscriptionId;
    if (input.notionalCostUsd !== undefined) {
      file.notionalCostUsd = input.notionalCostUsd;
    }
  } else if (input.notionalCostUsd !== undefined) {
    file.notionalCostUsd = input.notionalCostUsd;
  }
  if (input.spec) {
    file.spec = input.spec;
  }
  if (input.corrects) {
    file.corrects = input.corrects;
  }
  if (config.costAllocation.enabled) {
    if (input.costClass) {
      file.costClass = input.costClass;
    }
    // A stated figure wins; otherwise the events supply one. Fewer than two events measures no engagement,
    // so the figure is left absent rather than written as a zero the reads would have to trust.
    const events = input.operatorEvents ?? [];
    // A stated figure comes from the transcript attribution, which knows who was producing; bare operator
    // events can only be capped flatly. The recorded algorithm names whichever actually ran, so a figure
    // never claims to know more than it does.
    const attributed = input.operatorActiveSeconds !== undefined;
    const seconds =
      input.operatorActiveSeconds ??
      (events.length >= 2
        ? computeOperatorActiveSeconds(
            events,
            config.costAllocation.idleCapSeconds,
          )
        : undefined);
    if (seconds !== undefined) {
      file.operatorActiveSeconds = seconds;
      file.operatorActiveAlgorithm =
        input.operatorActiveAlgorithm ??
        `${attributed ? ATTRIBUTION_ALGORITHM : IDLE_CAP_ALGORITHM}:${config.costAllocation.idleCapSeconds}`;
      // The other two spans travel with it, so a reader can check that they sum to the session's span and
      // see how much of it needed nobody.
      if (input.agentAutonomousSeconds !== undefined) {
        file.agentAutonomousSeconds = input.agentAutonomousSeconds;
      }
      if (input.idleSeconds !== undefined) {
        file.idleSeconds = input.idleSeconds;
      }
    }
    file.operatorId =
      input.operatorId &&
      config.costAllocation.operators.includes(input.operatorId)
        ? input.operatorId
        : null;
  }
  return file;
}
