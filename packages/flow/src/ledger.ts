import type { Projection, RepositoryProjection } from './projection.ts';
import type { Distribution, Spend } from './signals.ts';

// The Ledger: one read surface over the projection. Every figure names its trust classes, its excluded
// count, and the changes or records behind it. Nothing is resolved to a person.

function seconds(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }
  if (value < 3600) {
    return `${Math.round(value / 60)}m`;
  }
  if (value < 86_400) {
    return `${(value / 3600).toFixed(1)}h`;
  }
  return `${(value / 86_400).toFixed(1)}d`;
}

function short(id: string): string {
  return id
    .split('<-')
    .map((part) => part.slice(0, 10))
    .join('<-');
}

function distributionLine(label: string, distribution: Distribution): string[] {
  const excluded = Object.entries(distribution.excluded)
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ');
  return [
    `${label}: typical (median) ${seconds(distribution.p50)}, 9 in 10 within ${seconds(distribution.p90)}, slowest ${seconds(distribution.max)} over ${distribution.count} changes [${distribution.trust.join(', ')}]${excluded ? `; excluded: ${excluded}` : ''}`,
    `  cites: ${distribution.cites.map(short).join(' ') || '(none)'}`,
  ];
}

function spendLine(label: string, spend: Spend): string {
  return `${label}: $${spend.costUsd.toFixed(2)}, ${spend.inputTokens + spend.outputTokens} tokens (${spend.cachedTokens} cached) over ${spend.sessions} sessions; cites: ${spend.cites.length ? spend.cites.join(' ') : '(none)'}`;
}

export function renderRepository(repository: RepositoryProjection): string[] {
  const lines: string[] = [
    `== ${repository.name} (${repository.defaultBranch})`,
  ];
  if (!repository.reachable) {
    lines.push(`  unreachable: ${repository.reason}`);
    return lines;
  }
  const signals = repository.signals!;
  if (repository.changes.length === 0) {
    lines.push(
      '  no changes on the default branch yet: merge a pull request through the hooks and rebuild',
    );
    return lines;
  }
  lines.push(
    ...distributionLine('  cycle time', signals.cycleTime).map((line) => line),
  );
  lines.push(...distributionLine('  wait time', signals.waitTime));
  lines.push(
    `  queue: ${signals.queue.count} unmerged pull requests, oldest ${seconds(signals.queue.oldestAgeSeconds)} [${signals.queue.trust.join(', ')}] (${signals.queue.note})`,
  );
  lines.push(
    `  batch size: median ${signals.batchSize.medianFiles ?? 'n/a'} files, ${signals.batchSize.medianLines ?? 'n/a'} lines, ${signals.batchSize.medianCommits ?? 'n/a'} commits over ${signals.batchSize.count} changes`,
  );
  lines.push(
    `  merge frequency: ${signals.mergeFrequency.perDay ?? 'n/a'} per day over ${signals.mergeFrequency.days ?? 'n/a'} days [${signals.mergeFrequency.trust.join(', ')}]`,
  );
  lines.push(
    `  rework (${signals.rework.windowDays}d window): ${signals.rework.pairs.length} pairs${signals.rework.pairs.length ? '; cites: ' + signals.rework.pairs.map((pair) => `${short(pair.later)}<-${short(pair.earlier)}`).join(' ') : ''}`,
  );
  lines.push(
    `  escapes after ${signals.escapes.release ?? '(no release)'}: ${signals.escapes.changes.length}${signals.escapes.changes.length ? '; cites: ' + signals.escapes.changes.map((entry) => `${short(entry.change)}(${entry.kind})`).join(' ') : ''}`,
  );
  const checks = Object.entries(signals.localChecks)
    .map(([outcome, count]) => `${count} ${outcome}`)
    .join(', ');
  lines.push(`  local checks: ${checks || 'none recorded'} [reported]`);
  const dora = signals.dora;
  lines.push(
    `  DORA (to the release tag): releases/week ${dora.deploymentFrequency.perWeek ?? 'n/a'} over ${dora.deploymentFrequency.releases} releases; lead time to release typical ${seconds(dora.leadTimeToRelease.p50)} (merge to tag ${seconds(dora.leadTimeToRelease.mergeToTag.p50)}); escapes/release ${dora.changeFailureRate.perRelease ?? 'n/a'} (${dora.changeFailureRate.escapes} over ${dora.changeFailureRate.releases}); time to fix typical ${seconds(dora.timeToFix.p50)} over ${dora.timeToFix.count} [observed]`,
  );
  lines.push(
    `  spend by cost class: ${
      Object.entries(signals.costClasses)
        .map(
          ([name, spend]) =>
            `${name} $${spend.costUsd.toFixed(2)} (${spend.sessions} sessions, ${spend.missingFigures} without figures)`,
        )
        .join(', ') || 'none'
    } [reported]`,
  );
  lines.push(
    `  coverage: ${signals.coverage.agent} with an agent session, ${signals.coverage.humanOnly} human-only, ${signals.coverage.undeclared} undeclared, ${signals.coverage.unreported} unreported of ${signals.coverage.total}`,
  );
  const allocation = signals.allocation;
  const money = (amount: number, currency: string) =>
    currency === 'USD'
      ? `$${amount.toFixed(2)}`
      : `${amount.toFixed(2)} ${currency}`;
  lines.push(
    `  subscription spend (allocated by ${allocation.basis}): ${
      allocation.periods
        .map(
          (period) =>
            `${period.period} ${period.planId} ${money(period.amount, period.currency)}${period.overageAmount ? ` + ${money(period.overageAmount, period.currency)} overage` : ''} over ${period.allocated} sessions${period.excludedNoAgentSeconds ? `, ${period.excludedNoAgentSeconds} with no agent seconds` : ''}${period.unallocated ? ' (unallocated)' : period.provisional ? ' (provisional)' : ''}`,
        )
        .join('; ') || 'no period record'
    } [${allocation.trust.join(', ')}]`,
  );
  for (const [currency, aggregates] of Object.entries(allocation.currencies)) {
    lines.push(
      `  allocated total ${currency}: ${money(aggregates.total.amount + aggregates.total.overage, currency)} over ${aggregates.total.sessions} sessions${aggregates.total.provisional ? ' (provisional)' : ''}; cites: ${aggregates.total.cites.join(' ') || '(none)'}`,
    );
    for (const [spec, spend] of Object.entries(aggregates.bySpec)) {
      lines.push(
        `  allocated by spec ${spec}: ${money(spend.amount + spend.overage, currency)} over ${spend.sessions} sessions`,
      );
    }
  }
  for (const { rate } of Object.values(allocation.currencies)) {
    if (rate.sessions === 0) {
      continue;
    }
    lines.push(
      rate.perMillionInputOutput === null
        ? `  rate: no tokens reported by the ${rate.sessions} allocated sessions, so no rate [allocated]`
        : `  rate: ${money(rate.perMillionInputOutput, rate.currency)} per million input and output tokens${rate.provisional ? ' (provisional)' : ''}, over ${rate.inputOutputTokens.toLocaleString('en-US')} tokens from ${rate.sessions} sessions${rate.withoutFigures ? `, ${rate.withoutFigures} of them reporting none` : ''}; ${rate.perMillionCached === null ? 'no cache reads' : `${money(rate.perMillionCached, rate.currency)} per million cache reads`} [allocated]`,
    );
  }
  lines.push(
    `  allocation excluded: ${allocation.excluded.noAgentSeconds} sessions with no agent seconds, ${allocation.excluded.noPeriodRecord} with no period record, ${allocation.excluded.invalidSession} invalid sessions, ${allocation.excluded.invalidRecord} invalid records (counted, never zeroed)`,
  );
  // The operator dimension: agents in the subscription's currency, humans in hours. Kept as separate lines
  // because the two units are never summed — no record holds a rate that could combine them.
  const operators = signals.operators;
  for (const [key, agent] of Object.entries(operators.agents)) {
    const amounts =
      Object.entries(agent.currencies)
        .map(([currency, amount]) =>
          money(amount.amount + amount.overage, currency),
        )
        .join(' ') || 'no subscription period';
    lines.push(
      `  agent ${key}: ${amounts}${agent.provisional ? ' (provisional)' : ''}, ${(agent.inputTokens + agent.outputTokens).toLocaleString('en-US')} tokens over ${agent.sessions} sessions`,
    );
  }
  for (const [id, human] of Object.entries(operators.humans)) {
    lines.push(
      `  operator ${id}: ${human.hours.toFixed(1)} h over ${human.sessions} sessions`,
    );
  }
  if (Object.keys(operators.humans).length === 0) {
    lines.push('  operator hours: none recorded');
  }
  // The reads the flow frameworks ask for after DORA, as lines rather than cards.
  const mix = Object.values(signals.workMix.weekly).reduce(
    (totals: Record<string, number>, week) => {
      for (const [type, entry] of Object.entries(week)) {
        totals[type] = (totals[type] ?? 0) + entry.changes;
      }
      return totals;
    },
    {},
  );
  const mixLine = Object.entries(mix)
    .sort(([, a], [, b]) => b - a)
    .map(([type, changes]) => `${type} ${changes}`)
    .join(', ');
  lines.push(`  work mix: ${mixLine || 'none'} [observed]`);
  const share = (value: number | null) =>
    value === null ? 'n/a' : `${Math.round(value * 100)}%`;
  lines.push(
    `  flow efficiency: ${share(signals.flowEfficiency.p50)} typical over ${signals.flowEfficiency.count} changes; excluded: ${
      Object.entries(signals.flowEfficiency.excluded)
        .map(([reason, n]) => `${n} ${reason}`)
        .join(', ') || 'none'
    } [${signals.flowEfficiency.trust.join(', ')}]`,
  );
  lines.push(
    `  iterations: ${signals.iterations.sessionsPerChange.p50 ?? 'n/a'} sessions and ${signals.iterations.commitsPerChange.p50 ?? 'n/a'} commits per change, typical`,
  );
  lines.push(
    `  older than ${seconds(signals.abandonment.afterSeconds)}: ${signals.abandonment.count} pull requests, ${signals.abandonment.tokens.toLocaleString('en-US')} tokens${signals.abandonment.withoutFigures ? `, ${signals.abandonment.withoutFigures} records without figures` : ''} [${signals.abandonment.trust.join(', ')}]`,
  );
  lines.push(
    `  spec lead time: ${seconds(signals.specLeadTime.p50)} typical over ${signals.specLeadTime.count} specs; excluded: ${
      Object.entries(signals.specLeadTime.excluded)
        .map(([reason, n]) => `${n} ${reason}`)
        .join(', ') || 'none'
    }`,
  );
  lines.push(
    `  check compliance: ${share(signals.checkCompliance.recordedShare)} of ${signals.checkCompliance.changes} changes recorded a check, ${share(signals.checkCompliance.passRate)} of those passed [${signals.checkCompliance.trust.join(', ')}]`,
  );
  for (const rate of signals.meteredRates) {
    lines.push(
      rate.perMillionInputOutput === null
        ? `  metered rate ${rate.provider} ${rate.currency}: no tokens reported over ${rate.sessions} sessions [reported]`
        : `  metered rate ${rate.provider} ${rate.currency}: ${money(rate.perMillionInputOutput, rate.currency)} per million input and output tokens over ${rate.inputOutputTokens.toLocaleString('en-US')} tokens from ${rate.sessions} sessions${rate.withoutTokens ? `, ${rate.withoutTokens} reporting none` : ''}${rate.cacheComponentsUnknown ? '; cache components unknown for some records' : ''} [reported]`,
    );
  }
  const gaps = repository.configurationGaps ?? [];
  lines.push(
    gaps.length === 0
      ? '  subscription configuration: no gaps [reported]'
      : `  subscription configuration: ${gaps.length} gaps [reported]`,
  );
  for (const gap of gaps) {
    lines.push(
      `    ${gap.subject}${gap.period ? ` ${gap.period}` : ''}: ${gap.kind}; closes with: ${gap.remedy}`,
    );
  }
  lines.push(
    `  rework ignore: ${signals.rework.ignored} pairs removed by ${signals.rework.ignore.length} globs`,
  );
  lines.push(
    `  operator excluded: ${operators.excluded.humanOnly} human-only changes, ${operators.excluded.noOperator} sessions without an operator identifier (counted, never zeroed) [${operators.trust.join(', ')}]`,
  );
  lines.push(
    `  ${spendLine('spend total', signals.spend.total)} [${signals.spend.trust.join(', ')}]`,
  );
  const excluded = signals.spend.excluded;
  lines.push(
    `  spend excluded: ${excluded.undeclared} undeclared, ${excluded.unreported} unreported, ${excluded.humanOnly} human-only, ${excluded.invalidSession} invalid session files, ${excluded.missingFigures} sessions with figures missing (counted, never zeroed)`,
  );
  for (const [spec, spend] of Object.entries(signals.spend.bySpec)) {
    lines.push(`  ${spendLine(`spend by spec ${spec}`, spend)}`);
  }
  for (const [provider, spend] of Object.entries(signals.spend.byProvider)) {
    lines.push(`  ${spendLine(`spend by provider ${provider}`, spend)}`);
  }
  for (const [model, spend] of Object.entries(signals.spend.byModel)) {
    lines.push(`  ${spendLine(`spend by model ${model}`, spend)}`);
  }
  for (const unit of Object.values(signals.spend.perEffortUnit)) {
    lines.push(
      `  cost per ${unit.unit}: ${unit.costPerUnit === null ? 'n/a' : '$' + unit.costPerUnit.toFixed(4)} over ${unit.changes} changes; excluded ${unit.excluded} for lacking the unit or a complete session record; cites: ${unit.cites.map(short).join(' ') || '(none)'}`,
    );
  }
  if (signals.spend.unmergedPullRequests.sessions > 0) {
    lines.push(
      `  ${spendLine('spend on unmerged pull requests', signals.spend.unmergedPullRequests)}`,
    );
  }
  const outOfBand = repository.changes.filter(
    (change) =>
      (change.association as { classification: string }).classification ===
      'out-of-band',
  );
  lines.push(
    `  out-of-band changes: ${outOfBand.length}${outOfBand.length ? '; cites: ' + outOfBand.map((change) => short(change.id as string)).join(' ') : ''}`,
  );
  lines.push(`  unreleased changes: ${repository.unreleased.length}`);
  if (repository.movedTags.length > 0) {
    lines.push(
      `  moved tags: ${(repository.movedTags as { tag: string }[]).map((entry) => entry.tag).join(', ')}`,
    );
  }
  for (const signal of signals.signals) {
    lines.push(
      `  SIGNAL ${signal.signal}: observed ${signal.observed} over threshold ${signal.threshold}; cites: ${signal.cites.map(short).join(' ')}`,
    );
  }
  return lines;
}

export function renderLedger(projection: Projection | null): string {
  if (!projection || Object.keys(projection.repositories).length === 0) {
    return [
      'The Ledger is empty.',
      'Register a repository in registry.json, then run: telemetry sync && telemetry rebuild',
    ].join('\n');
  }
  const lines: string[] = [
    `The Ledger (projection schema ${projection.schemaVersion}, session schema ${projection.sessionSchemaVersion})`,
  ];
  for (const repository of Object.values(projection.repositories)) {
    lines.push('', ...renderRepository(repository));
  }
  const unreachable = Object.values(projection.repositories).filter(
    (repository) => !repository.reachable,
  );
  lines.push(
    '',
    `repositories: ${Object.keys(projection.repositories).length} registered, ${unreachable.length} unreachable${unreachable.length ? ' (' + unreachable.map((r) => r.name).join(', ') + ')' : ''}`,
  );
  return lines.join('\n');
}
