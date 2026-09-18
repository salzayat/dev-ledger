import {
  PLANS_PATH,
  SUBSCRIPTIONS_PATH,
  intervalFor,
  validatePlansFile,
  validateSubscriptionFile,
  type PlanDeclaration,
  type PlansFile,
  type SubscriptionCostFile,
} from '@dev-ledger/capture';
import { readBlob, treeFiles } from './git.ts';

// Subscription cost records: what a plan cost for a billing period, read from the default branch's tree.
// The amount is operator-entered, so the record is `reported`; every figure apportioned from it is
// `allocated`, and the projection never confuses the two.

export type SubscriptionRecord = {
  path: string;
  producer: 'operator';
  trust: 'reported';
  valid: boolean;
  errors: string[];
  file: SubscriptionCostFile | null;
};

export function collectSubscriptions(
  dir: string,
  branch: string,
): SubscriptionRecord[] {
  return (
    treeFiles(dir, branch, SUBSCRIPTIONS_PATH)
      // The plan declarations live in this directory too and are a different kind of file; reading them as a
      // cost record would report a perfectly good declaration as an invalid record.
      .filter((path) => path.endsWith('.json') && path !== PLANS_PATH)
      .sort()
      .map((path) => {
        const text = readBlob(dir, branch, path);
        let file: SubscriptionCostFile | null = null;
        let errors: string[] = ['subscription cost record could not be read'];
        if (text !== null) {
          try {
            const parsed = JSON.parse(text) as SubscriptionCostFile;
            errors = validateSubscriptionFile(parsed);
            file = errors.length === 0 ? parsed : null;
          } catch (error) {
            errors = [
              `subscription cost record is not valid JSON: ${(error as Error).message}`,
            ];
          }
        }
        return {
          path,
          producer: 'operator',
          trust: 'reported',
          valid: errors.length === 0,
          errors,
          file,
        };
      })
  );
}

export type PlanRecord = {
  path: string;
  valid: boolean;
  errors: string[];
  plans: PlanDeclaration[];
};

/** The plan declarations from the default branch's tree, or an empty set when none is committed. */
export function collectPlans(dir: string, branch: string): PlanRecord {
  const text = readBlob(dir, branch, PLANS_PATH);
  if (text === null) {
    return { path: PLANS_PATH, valid: true, errors: [], plans: [] };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    const errors = validatePlansFile(parsed);
    return {
      path: PLANS_PATH,
      valid: errors.length === 0,
      errors,
      plans: errors.length === 0 ? (parsed as PlansFile).plans : [],
    };
  } catch (error) {
    return {
      path: PLANS_PATH,
      valid: false,
      errors: [
        `plan declarations are not valid JSON: ${(error as Error).message}`,
      ],
      plans: [],
    };
  }
}

export type ConfigurationGap = {
  kind:
    | 'missing-record'
    | 'undeclared-plan'
    | 'unknown-subscription'
    | 'uncovered-period';
  /** The plan, session, or period the gap concerns. */
  subject: string;
  period: string | null;
  /** The command that closes it. */
  remedy: string;
  cites: string[];
};

/**
 * What is missing between the declarations, the records, and the sessions that cite them.
 *
 * This is a read, not a repair. The Ledger names each gap and the command that closes it, because the
 * published page reads only from the projection and carries no form; an operator runs the command.
 */
export function configurationGaps(
  plans: PlanRecord,
  records: SubscriptionRecord[],
  sessionPeriods: { planId: string; period: string; path: string }[],
  closedPeriods: string[],
): ConfigurationGap[] {
  const gaps: ConfigurationGap[] = [];
  const have = new Set(
    records
      .filter((record) => record.file)
      .map((record) => `${record.file!.period}/${record.file!.planId}`),
  );
  const declared = new Map(plans.plans.map((plan) => [plan.planId, plan]));

  for (const plan of plans.plans) {
    for (const period of closedPeriods) {
      if (have.has(`${period}/${plan.planId}`)) {
        continue;
      }
      if (intervalFor(plan, period) === null) {
        gaps.push({
          kind: 'uncovered-period',
          subject: plan.planId,
          period,
          remedy: `add an interval covering ${period} to ${PLANS_PATH}`,
          cites: [PLANS_PATH],
        });
        continue;
      }
      gaps.push({
        kind: 'missing-record',
        subject: plan.planId,
        period,
        remedy: `./scripts/telemetry.sh subscription close ${period}`,
        cites: [PLANS_PATH],
      });
    }
  }

  for (const record of records) {
    if (!record.file || declared.has(record.file.planId)) {
      continue;
    }
    gaps.push({
      kind: 'undeclared-plan',
      subject: record.file.planId,
      period: record.file.period,
      remedy: `declare ${record.file.planId} in ${PLANS_PATH}`,
      cites: [record.path],
    });
  }

  const covered = new Set(
    records
      .filter((record) => record.file)
      .map((record) => `${record.file!.period}/${record.file!.planId}`),
  );
  const named = new Map<string, string[]>();
  for (const session of sessionPeriods) {
    const key = `${session.period}/${session.planId}`;
    if (covered.has(key)) {
      continue;
    }
    (named.get(key) ?? named.set(key, []).get(key)!).push(session.path);
  }
  for (const [key, paths] of [...named.entries()].sort()) {
    const [period, planId] = [key.slice(0, 7), key.slice(8)];
    gaps.push({
      kind: 'unknown-subscription',
      subject: planId,
      period,
      remedy: declared.has(planId)
        ? `./scripts/telemetry.sh subscription close ${period}`
        : `declare ${planId} in ${PLANS_PATH}, then close ${period}`,
      cites: paths,
    });
  }
  return gaps;
}
