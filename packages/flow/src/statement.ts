import type { Projection } from './projection.ts';

// A period statement: the figures finance or a client asks for, for one month, per repository and in
// total, as rows a spreadsheet can take. Every row names its trust class. Allocated spend and hours are
// monthly facts; classes and specs are reported over the measured window, and the row says so.

export type StatementRow = {
  period: string;
  repository: string;
  kind: 'allocation' | 'hours' | 'timesheet' | 'class' | 'spec' | 'velocity';
  key: string;
  metric: string;
  value: number;
  unit: string;
  trust: string;
  scope: 'period' | 'window';
};

export function buildStatement(
  projection: Projection,
  period: string,
): StatementRow[] {
  const rows: StatementRow[] = [];
  const push = (row: Omit<StatementRow, 'period'>) =>
    rows.push({ period, ...row });
  for (const repository of Object.values(projection.repositories)) {
    const signals = repository.signals;
    if (!repository.reachable || !signals) {
      continue;
    }
    const name = repository.name;
    for (const p of signals.allocation.periods.filter(
      (entry) => entry.period === period,
    )) {
      push({
        repository: name,
        kind: 'allocation',
        key: p.planId,
        metric: 'amount',
        value: p.amount,
        unit: p.currency,
        trust: 'allocated',
        scope: 'period',
      });
      push({
        repository: name,
        kind: 'allocation',
        key: p.planId,
        metric: 'overage',
        value: p.overageAmount,
        unit: p.currency,
        trust: 'allocated',
        scope: 'period',
      });
      push({
        repository: name,
        kind: 'allocation',
        key: p.planId,
        metric: p.provisional ? 'provisional' : 'closed',
        value: p.provisional ? 1 : 0,
        unit: 'flag',
        trust: 'allocated',
        scope: 'period',
      });
    }
    for (const [operator, entry] of Object.entries(signals.hours.byOperator)) {
      const month = entry.byMonth[period];
      if (!month) {
        continue;
      }
      push({
        repository: name,
        kind: 'hours',
        key: operator,
        metric: 'measured',
        value: month.measured,
        unit: 'hours',
        trust: 'reported',
        scope: 'period',
      });
      if (month.confirmed !== null) {
        push({
          repository: name,
          kind: 'timesheet',
          key: operator,
          metric: 'confirmed',
          value: month.confirmed,
          unit: 'hours',
          trust: 'reported',
          scope: 'period',
        });
      }
    }
    for (const [cls, spend] of Object.entries(signals.costClasses)) {
      push({
        repository: name,
        kind: 'class',
        key: cls,
        metric: 'reported',
        value: spend.costUsd,
        unit: 'USD',
        trust: 'reported',
        scope: 'window',
      });
      push({
        repository: name,
        kind: 'class',
        key: cls,
        metric: 'allocated',
        value: spend.allocated,
        unit: spend.currency ?? '',
        trust: 'allocated',
        scope: 'window',
      });
      push({
        repository: name,
        kind: 'class',
        key: cls,
        metric: 'hours',
        value: Math.round(spend.hours * 100) / 100,
        unit: 'hours',
        trust: 'reported',
        scope: 'window',
      });
    }
    for (const [currency, aggregates] of Object.entries(
      signals.allocation.currencies,
    )) {
      for (const [spec, share] of Object.entries(aggregates.bySpec)) {
        push({
          repository: name,
          kind: 'spec',
          key: spec,
          metric: 'allocated',
          value: Math.round((share.amount + share.overage) * 1e6) / 1e6,
          unit: currency,
          trust: 'allocated',
          scope: 'window',
        });
      }
    }
    push({
      repository: name,
      kind: 'velocity',
      key: 'tasks',
      metric: 'completed',
      value: signals.velocity.tasks,
      unit: 'tasks',
      trust: 'observed',
      scope: 'window',
    });
    push({
      repository: name,
      kind: 'velocity',
      key: 'complexity',
      metric: 'completed',
      value: signals.velocity.complexity,
      unit: 'points',
      trust: 'observed',
      scope: 'window',
    });
  }
  return rows;
}

const HEADER: (keyof StatementRow)[] = [
  'period',
  'repository',
  'kind',
  'key',
  'metric',
  'value',
  'unit',
  'trust',
  'scope',
];

function cell(value: unknown): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function statementCsv(rows: StatementRow[]): string {
  return (
    [
      HEADER.join(','),
      ...rows.map((row) => HEADER.map((key) => cell(row[key])).join(',')),
    ].join('\n') + '\n'
  );
}
