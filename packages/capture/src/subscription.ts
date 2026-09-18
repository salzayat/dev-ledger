// A subscription cost record: what a plan cost for one billing period, entered by the operator and
// committed with the work. A subscription session records no marginal cost (the contract fixes its
// `costUsd` at zero); the cost is a property of the period, so the period is the record. The projection
// apportions it across the period's sessions by agent run seconds, and every figure so derived is
// `allocated`, never `reported`.

export const SUBSCRIPTION_SCHEMA_VERSION = 1;
export const SUBSCRIPTIONS_PATH = '.telemetry/subscriptions';

export type SubscriptionCostFile = {
  schemaVersion: number;
  /** Matches the `subscriptionId` of the sessions it covers. */
  planId: string;
  /** The billing period, `YYYY-MM`. */
  period: string;
  amount: number;
  /** ISO 4217 code, upper case. */
  currency: string;
  /** Paid beyond the plan in the period; zero when none. */
  overageAmount: number;
};

/** The same vocabulary a session record rejects, so no rate or salary can enter a period record either. */
const FORBIDDEN_KEYS =
  /^(name|operatorName|email|operatorEmail|hourlyRate|rate|salary|compensation|userName|user)$/i;

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const PLAN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The path of a subscription cost record relative to the repository root. */
export function subscriptionFilePath(planId: string, period: string): string {
  if (!PERIOD.test(period)) {
    throw new Error(`period must be YYYY-MM, got "${period}"`);
  }
  if (!PLAN_ID.test(planId)) {
    throw new Error(`planId must be a short identifier, got "${planId}"`);
  }
  return `${SUBSCRIPTIONS_PATH}/${period}/${planId}.json`;
}

/** The billing period a session ends in, in the form a record names. */
export function periodOf(endedAt: string): string {
  return endedAt.slice(0, 7);
}

export function validateSubscriptionFile(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['subscription cost record must be a JSON object'];
  }
  const file = value as Record<string, unknown>;
  for (const key of Object.keys(file)) {
    if (FORBIDDEN_KEYS.test(key)) {
      errors.push(
        `${key} is not allowed: a subscription cost record carries no name, email address, or rate`,
      );
    }
  }
  if (file.schemaVersion !== SUBSCRIPTION_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SUBSCRIPTION_SCHEMA_VERSION}`);
  }
  if (typeof file.planId !== 'string' || !PLAN_ID.test(file.planId)) {
    errors.push(
      'planId must be a short identifier matching the sessions it covers',
    );
  }
  if (typeof file.period !== 'string' || !PERIOD.test(file.period)) {
    errors.push('period must be YYYY-MM');
  }
  for (const key of ['amount', 'overageAmount']) {
    if (
      typeof file[key] !== 'number' ||
      !Number.isFinite(file[key] as number) ||
      (file[key] as number) < 0
    ) {
      errors.push(`${key} must be a non-negative number`);
    }
  }
  if (typeof file.currency !== 'string' || !/^[A-Z]{3}$/.test(file.currency)) {
    errors.push('currency must be a three-letter upper-case code');
  }
  return errors;
}

export type SubscriptionInput = {
  planId: string;
  period: string;
  amount: number;
  currency: string;
  overageAmount?: number;
};

export function buildSubscriptionFile(
  input: SubscriptionInput,
): SubscriptionCostFile {
  return {
    schemaVersion: SUBSCRIPTION_SCHEMA_VERSION,
    planId: input.planId,
    period: input.period,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    overageAmount: input.overageAmount ?? 0,
  };
}
