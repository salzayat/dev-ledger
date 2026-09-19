import type { RepositoryProjection } from './projection.ts';

// The registry rollup: the same figures summed across every reachable repository, keyed the same way.
// A spec that spans two repositories is one row here and two rows on the repository pages.

export type RollupSpend = {
  reported: number;
  allocated: number;
  currency: string | null;
  tokens: number;
  hours: number;
  sessions: number;
  repositories: string[];
};

export type Rollup = {
  repositories: string[];
  bySpec: Record<string, RollupSpend>;
  byClass: Record<string, RollupSpend>;
  hours: Record<
    string,
    { measured: number; confirmed: number; bySpec: Record<string, number> }
  >;
  velocity: { tasks: number; complexity: number; changes: number };
  note: string;
};

const round = (value: number) => Math.round(value * 1e6) / 1e6;

function bucket(): RollupSpend {
  return {
    reported: 0,
    allocated: 0,
    currency: null,
    tokens: 0,
    hours: 0,
    sessions: 0,
    repositories: [],
  };
}

export function computeRollup(
  repositories: Record<string, RepositoryProjection>,
): Rollup {
  const rollup: Rollup = {
    repositories: [],
    bySpec: {},
    byClass: {},
    hours: {},
    velocity: { tasks: 0, complexity: 0, changes: 0 },
    note: 'summed across every reachable repository in the registry; reported and allocated stay apart, hours stay hours, and a spec that spans repositories is one row',
  };
  for (const repository of Object.values(repositories)) {
    const signals = repository.signals;
    if (!repository.reachable || !signals) {
      continue;
    }
    rollup.repositories.push(repository.name);
    const allocatedBySpec: Record<
      string,
      { amount: number; currency: string }
    > = {};
    for (const [currency, aggregates] of Object.entries(
      signals.allocation.currencies,
    )) {
      for (const [spec, share] of Object.entries(aggregates.bySpec)) {
        allocatedBySpec[spec] = {
          amount: share.amount + share.overage,
          currency,
        };
      }
    }
    const specs = new Set([
      ...Object.keys(signals.spend.bySpec),
      ...Object.keys(allocatedBySpec),
    ]);
    for (const spec of specs) {
      const row = (rollup.bySpec[spec] ??= bucket());
      const reported = signals.spend.bySpec[spec];
      if (reported) {
        row.reported = round(row.reported + reported.costUsd);
        row.tokens += reported.inputTokens + reported.outputTokens;
        row.sessions += reported.sessions;
      }
      const allocated = allocatedBySpec[spec];
      if (allocated) {
        row.allocated = round(row.allocated + allocated.amount);
        row.currency ??= allocated.currency;
      }
      row.repositories.push(repository.name);
    }
    for (const [name, spend] of Object.entries(signals.costClasses)) {
      const row = (rollup.byClass[name] ??= bucket());
      row.reported = round(row.reported + spend.costUsd);
      row.allocated = round(row.allocated + spend.allocated);
      row.currency ??= spend.currency;
      row.hours = round(row.hours + spend.hours);
      row.sessions += spend.sessions;
      row.repositories.push(repository.name);
    }
    for (const [operator, entry] of Object.entries(signals.hours.byOperator)) {
      const row = (rollup.hours[operator] ??= {
        measured: 0,
        confirmed: 0,
        bySpec: {},
      });
      row.measured = round(row.measured + entry.measured);
      for (const month of Object.values(entry.byMonth)) {
        row.confirmed = round(row.confirmed + (month.confirmed ?? 0));
      }
      for (const [spec, hours] of Object.entries(entry.bySpec)) {
        row.bySpec[spec] = round((row.bySpec[spec] ?? 0) + hours);
        const specRow = (rollup.bySpec[spec] ??= bucket());
        specRow.hours = round(specRow.hours + hours);
      }
    }
    rollup.velocity.tasks += signals.velocity.tasks;
    rollup.velocity.complexity += signals.velocity.complexity;
    rollup.velocity.changes += signals.velocity.changes;
  }
  return rollup;
}
