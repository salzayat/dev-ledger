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

// --- Plan declarations ------------------------------------------------------------------------------

/**
 * What a plan is arranged to cost, as intervals that each hold from a period until the next one starts.
 *
 * The period record above says what was paid in one month; this says what the plan costs, which changes
 * rarely and on a date. Holding both in the period file would make a rate change indistinguishable from a
 * typo and would make "what did this plan cost in March" a question answered only by opening March.
 */
export const PLANS_PATH = `${SUBSCRIPTIONS_PATH}/plans.json`;

export type PlanInterval = {
  /** The period from which this interval holds, `YYYY-MM`. */
  from: string;
  /** The amount per seat for the period. */
  unit: number;
  seats: number;
};

export type PlanDeclaration = {
  planId: string;
  provider: string;
  /** ISO 4217 code, upper case. */
  currency: string;
  intervals: PlanInterval[];
};

export type PlansFile = {
  schemaVersion: number;
  plans: PlanDeclaration[];
};

/** Validates a parsed plans file. Returns every problem, so one run names them all. */
export function validatePlansFile(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['plans file must be a JSON object'];
  }
  const file = value as Record<string, unknown>;
  if (file.schemaVersion !== SUBSCRIPTION_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SUBSCRIPTION_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(file.plans)) {
    errors.push('plans must be a list');
    return errors;
  }
  const seen = new Set<string>();
  file.plans.forEach((entry, index) => {
    const label = `plans[${index}]`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      errors.push(`${label} must be an object`);
      return;
    }
    const plan = entry as Record<string, unknown>;
    for (const key of Object.keys(plan)) {
      if (FORBIDDEN_KEYS.test(key)) {
        errors.push(
          `${label}.${key} is not allowed: a plan declaration carries no name, email address, or rate`,
        );
      }
    }
    if (typeof plan.planId !== 'string' || !PLAN_ID.test(plan.planId)) {
      errors.push(`${label}.planId must be a short identifier`);
    } else if (seen.has(plan.planId)) {
      errors.push(
        `${label}.planId "${plan.planId}" is declared more than once`,
      );
    } else {
      seen.add(plan.planId);
    }
    if (typeof plan.provider !== 'string' || plan.provider.length === 0) {
      errors.push(`${label}.provider is required`);
    }
    if (
      typeof plan.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(plan.currency)
    ) {
      errors.push(`${label}.currency must be an ISO 4217 code in upper case`);
    }
    if (!Array.isArray(plan.intervals) || plan.intervals.length === 0) {
      errors.push(`${label}.intervals must be a non-empty list`);
      return;
    }
    let previous: string | null = null;
    plan.intervals.forEach((raw, position) => {
      const where = `${label}.intervals[${position}]`;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        errors.push(`${where} must be an object`);
        return;
      }
      const interval = raw as Record<string, unknown>;
      if (typeof interval.from !== 'string' || !PERIOD.test(interval.from)) {
        errors.push(`${where}.from must be a period of the form YYYY-MM`);
      } else {
        // Ordered and non-overlapping: an interval holds until the next one starts, so two intervals
        // claiming the same period would make the amount for that period ambiguous.
        if (previous !== null && interval.from <= previous) {
          errors.push(
            `${where}.from must come after ${previous}; intervals are ordered and never overlap`,
          );
        }
        previous = interval.from;
      }
      for (const key of ['unit', 'seats'] as const) {
        const figure = interval[key];
        if (
          typeof figure !== 'number' ||
          !Number.isFinite(figure) ||
          figure < 0
        ) {
          errors.push(`${where}.${key} must be a non-negative number`);
        }
      }
    });
  });
  return errors;
}

/**
 * The interval covering a period, or null when none does. A period before a plan's earliest interval is
 * uncovered and is reported as such rather than resolving to the nearest: the plan did not cost anything
 * then, because it did not exist yet, and guessing would invent a figure.
 */
export function intervalFor(
  plan: PlanDeclaration,
  period: string,
): PlanInterval | null {
  let covering: PlanInterval | null = null;
  for (const interval of plan.intervals) {
    if (interval.from <= period) {
      covering = interval;
    }
  }
  return covering;
}

/** What a plan's period costs: seats times unit, so the amount is checkable arithmetic. */
export function amountFor(
  plan: PlanDeclaration,
  period: string,
): number | null {
  const interval = intervalFor(plan, period);
  if (interval === null) {
    return null;
  }
  return Math.round(interval.unit * interval.seats * 100) / 100;
}
