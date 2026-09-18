import type { TelemetryConfig } from './config.ts';

// One file per work session, written by the harness hook at session end and committed with the work.

export const SESSION_SCHEMA_VERSION = 1;
export const SESSIONS_PATH = '.telemetry/sessions';
export const IDLE_CAP_ALGORITHM = 'idle-cap-v1';

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
  costUsd?: number;
  notionalCostUsd?: number;
  figuresSource: string;
  startedAt: string;
  endedAt: string;
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
  operatorId?: string | null;
  corrects?: string;
};

/** Builds a session file from the harness's figures, applying the configuration's allocation rules. */
export function buildSessionFile(
  input: SessionInput,
  config: TelemetryConfig,
): SessionFile {
  const wallClockSeconds = Math.max(
    0,
    Math.round(
      (Date.parse(input.endedAt) - Date.parse(input.startedAt)) / 1000,
    ),
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
    startedAt: input.startedAt,
    endedAt: input.endedAt,
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
        `${IDLE_CAP_ALGORITHM}:${config.costAllocation.idleCapSeconds}`;
    }
    file.operatorId =
      input.operatorId &&
      config.costAllocation.operators.includes(input.operatorId)
        ? input.operatorId
        : null;
  }
  return file;
}
