import type { Projection, RepositoryProjection } from './projection.ts';
import type {
  AllocatedSpend,
  Allocation,
  CostClassSpend,
  Coverage,
  Distribution,
  RepositorySignals,
  Spend,
  Operators,
  WeeklyBucket,
} from './signals.ts';

// The Ledger as one self-contained HTML page: inline styles, inline SVG, no script, no loaded resource.
// Same figures as the terminal render, laid out per repository, with trust classes and excluded counts
// beside every figure and its citations expandable beneath it. Every cited commit shows the change's
// subject beside its abbreviated hash and links to the hosting platform when the repository records a
// web URL; with no web URL the same text renders unlinked, so the page still opens from a file URL.

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function seconds(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }
  if (value < 60) {
    return `${Math.round(value)} s`;
  }
  if (value < 3600) {
    return `${Math.round(value / 60)} min`;
  }
  if (value < 86_400) {
    return `${(value / 3600).toFixed(1)} h`;
  }
  return `${(value / 86_400).toFixed(1)} d`;
}

function dateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : 'unknown';
}

function ageFrom(asOf: string | null, from: string | null): number | null {
  if (!asOf || !from) {
    return null;
  }
  return Math.max(0, Math.round((Date.parse(asOf) - Date.parse(from)) / 1000));
}

export function count(
  value: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

// --- Citations -------------------------------------------------------------------------------------

const HASH = /^[0-9a-f]{40}$/;

/** What the page needs to turn a cite string into a titled, linked citation. */
export type Links = {
  web: string | null;
  branch: string;
  subjects: Map<string, string>;
  records: Map<string, string>;
};

export function linksFor(repository: RepositoryProjection): Links {
  const subjects = new Map<string, string>();
  for (const change of repository.changes as {
    id: string;
    subject: string;
  }[]) {
    subjects.set(change.id, change.subject);
  }
  const records = new Map<string, string>();
  for (const session of repository.sessions as {
    sessionId: string;
    path: string;
  }[]) {
    records.set(session.sessionId, session.path);
  }
  return {
    web: repository.webUrl,
    branch: repository.defaultBranch,
    subjects,
    records,
  };
}

/** A session identifier, linked to its record file when the projection holds one. */
function sessionRef(id: string, links: Links): string {
  const path = links.records.get(id);
  return path === undefined
    ? `<code>${escapeHtml(id)}</code>`
    : href(links, `blob/${links.branch}/${path}`, id);
}

/** A reported cost: the figure when one was reported, "none" when every contributing session was on a subscription. */
function reportedCost(costUsd: number, sessions: number): string {
  if (sessions === 0) {
    return '<span class="dim">none</span>';
  }
  return costUsd > 0
    ? `$${costUsd.toFixed(2)}`
    : '<span class="dim">none reported</span>';
}

/** A spend cell: the tokens the records carry, the reported cost when there is one, never a zero. */
function spendCell(spend: Spend | undefined, absent: string): string {
  if (!spend || spend.sessions === 0) {
    return `<span class="dim">${escapeHtml(absent)}</span>`;
  }
  const tokens = `<span class="dim">${(spend.inputTokens + spend.outputTokens).toLocaleString('en-US')} tok</span>`;
  return spend.costUsd > 0 ? `$${spend.costUsd.toFixed(2)} ${tokens}` : tokens;
}

/** Excluded counts, without the zeros: an exclusion that did not happen is not a figure. */
function nonZero(parts: [number, string][]): string {
  const kept = parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`);
  return kept.length ? kept.join(', ') : 'none';
}

/**
 * Man hours beside the tokens: the operator's own time, and how much of the work needed nobody. A record
 * with no operator figure is named rather than rendered as an hour of zero.
 */
function hoursCell(spend: Spend | undefined): string {
  if (!spend || spend.sessions === 0) {
    return '<span class="dim">—</span>';
  }
  if (spend.operatorSeconds === 0 && spend.withoutOperatorTime > 0) {
    return `<span class="dim">${spend.withoutOperatorTime} without operator time</span>`;
  }
  const autonomous =
    spend.agentAutonomousSeconds > 0
      ? ` <span class="dim">${(spend.agentAutonomousSeconds / 3600).toFixed(1)} h autonomous</span>`
      : '';
  return `${(spend.operatorSeconds / 3600).toFixed(1)} h${autonomous}`;
}

/** An amount in its currency: `$12.34` for USD, `12.34 EUR` for anything else. */
function money(amount: number, currency: string): string {
  return currency === 'USD'
    ? `$${amount.toFixed(2)}`
    : `${amount.toFixed(2)} ${currency}`;
}

/** Money that may be far below a cent per unit: shown to four places when two would round to nothing. */
function preciseMoney(amount: number, currency: string): string {
  const digits = amount > 0 && amount < 0.01 ? 4 : 2;
  return currency === 'USD'
    ? `$${amount.toFixed(digits)}`
    : `${amount.toFixed(digits)} ${currency}`;
}

/** The allocated share beside a reported figure, marked when its period has not closed. */
function allocatedCell(
  allocation: Allocation,
  pick: (
    aggregates: Allocation['currencies'][string],
  ) => AllocatedSpend | undefined,
): string {
  const parts = Object.entries(allocation.currencies)
    .map(([currency, aggregates]) => [currency, pick(aggregates)] as const)
    .filter(
      (entry): entry is readonly [string, AllocatedSpend] =>
        entry[1] !== undefined && entry[1].sessions > 0,
    )
    .map(
      ([currency, spend]) =>
        `<span class="alloc">${escapeHtml(money(spend.amount + spend.overage, currency))} allocated${spend.provisional ? ' <span class="dim">provisional</span>' : ''}</span>`,
    );
  return parts.length ? ` ${parts.join(' ')}` : '';
}

function href(links: Links, path: string, text: string, extra = ''): string {
  const inner = `<code>${escapeHtml(text)}</code>`;
  return links.web === null
    ? inner
    : `<a class="ref"${extra} href="${escapeHtml(`${links.web}/${path}`)}">${inner}</a>`;
}

/** One cite string: a change id, `pull/<number>`, a session record path, or `<later><-<earlier>`. */
function cite(id: string, links: Links): string {
  return id
    .split('<-')
    .map((part) => citePart(part, links))
    .join('<span class="cite-join">←</span>');
}

function citePart(part: string, links: Links): string {
  if (HASH.test(part)) {
    const subject = links.subjects.get(part);
    const hash = href(links, `commit/${part}`, part.slice(0, 10));
    return subject
      ? `${hash} <span class="cite-title">${escapeHtml(subject)}</span>`
      : hash;
  }
  const pull = /^pull\/(\d+)$/.exec(part);
  if (pull) {
    return href(links, `pull/${pull[1]}`, `#${pull[1]}`);
  }
  if (part.includes('/') && !part.includes(' ')) {
    return href(links, `blob/${links.branch}/${part}`, part);
  }
  return `<code>${escapeHtml(part)}</code>`;
}

function pullRef(number: number | null, links: Links): string {
  return number === null
    ? `<span class="warn">out-of-band</span>`
    : href(links, `pull/${number}`, `#${number}`);
}

export function cites(label: string, ids: string[], links: Links): string {
  if (ids.length === 0) {
    return `<p class="cites-empty">cites: none</p>`;
  }
  const items = ids.map((id) => `<li>${cite(id, links)}</li>`).join('');
  return `<details class="cites"><summary>${escapeHtml(label)}: ${ids.length}</summary><ul>${items}</ul></details>`;
}

/** The allocated total across currencies, or what stands in its place. */
function allocatedTotal(allocation: Allocation): string {
  const totals = Object.entries(allocation.currencies)
    .filter(([, aggregates]) => aggregates.total.sessions > 0)
    .map(
      ([currency, aggregates]) =>
        `${money(aggregates.total.amount + aggregates.total.overage, currency)}${aggregates.total.provisional ? ' (provisional)' : ''}`,
    );
  if (totals.length > 0) {
    return totals.join(' + ');
  }
  return allocation.periods.length > 0 ? 'unallocated' : 'no period record';
}

function allocationPanel(allocation: Allocation, links: Links): string {
  const rows = allocation.periods
    .map(
      (period) =>
        `<tr><td class="mono">${escapeHtml(period.period)}</td><td><code>${escapeHtml(period.planId)}</code></td><td class="num">${escapeHtml(money(period.amount, period.currency))}</td><td class="num">${period.overageAmount > 0 ? escapeHtml(money(period.overageAmount, period.currency)) : '<span class="dim">none</span>'}</td><td class="num">${period.allocated}</td><td class="num">${period.excludedNoAgentSeconds}</td><td>${period.unallocated ? '<span class="warn">unallocated</span>' : period.provisional ? '<span class="dim">provisional</span>' : 'closed'}</td><td>${cites('records', period.cites, links)}</td></tr>`,
    )
    .join('');
  const excluded = allocation.excluded;
  const excludedLine = `${excluded.noAgentSeconds} with no agent seconds, ${excluded.noPeriodRecord} with no period record, ${excluded.invalidSession} invalid sessions, ${excluded.invalidRecord} invalid records`;
  const body = rows
    ? `<div class="scroll"><table><thead><tr><th>period</th><th>plan</th><th class="num">amount</th><th class="num">overage</th><th class="num">allocated over</th><th class="num">no agent seconds</th><th>status</th><th>cites</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<p class="empty">No subscription cost record yet. Record one with <code>telemetry subscription record</code>; until then every subscription session reads as excluded for lacking a period record.</p>`;
  return panel(
    'Subscription spend',
    `${figure(escapeHtml(allocatedTotal(allocation)), 'allocated across the sessions of each recorded period, by agent run seconds; provisional means the period has not closed')}${body}${rateBlock(allocation)}`,
    `${trustBadges(allocation.trust)} ${escapeHtml(allocation.note)}; excluded: ${escapeHtml(excludedLine)} (counted, never zeroed)`,
  );
}

/**
 * What the allocated amount worked out to per token. Input plus output leads because those are the tokens
 * the work asked for; cache reads follow in their own line rather than joining the denominator, where they
 * would make the same money look roughly two hundred times cheaper.
 */
function rateBlock(allocation: Allocation): string {
  const blocks = Object.values(allocation.currencies)
    .filter((aggregates) => aggregates.rate.sessions > 0)
    .map(({ rate }) => {
      if (rate.perMillionInputOutput === null) {
        return `<p class="meta">No session that took a share reported tokens, so no rate can be computed over ${rate.sessions} allocated ${rate.sessions === 1 ? 'session' : 'sessions'}.</p>`;
      }
      const cached =
        rate.perMillionCached === null
          ? '<span class="dim">no cache reads recorded</span>'
          : `<span class="dim">${escapeHtml(money(rate.perMillionCached, rate.currency))} per million cache reads, over ${rate.cachedTokens.toLocaleString('en-US')}</span>`;
      const missing =
        rate.withoutFigures > 0
          ? ` ${rate.withoutFigures} of them reported no tokens and are counted, not dropped, so the rate reads high.`
          : '';
      return (
        `<p class="figure">${escapeHtml(money(rate.perMillionInputOutput, rate.currency))}<span class="unit">per million input and output tokens${rate.provisional ? ', provisional' : ''}</span></p>` +
        `<p class="meta">${escapeHtml(money(rate.amount, rate.currency))} over ${rate.inputOutputTokens.toLocaleString('en-US')} input and output tokens from ${rate.sessions} allocated ${rate.sessions === 1 ? 'session' : 'sessions'}.${escapeHtml(missing)} ${cached}. A subscription has no token component, so this is what the amount worked out to, not a price.</p>`
      );
    })
    .join('');
  return blocks;
}

type NoteRow = {
  path: string;
  file: { figure: string; period?: string; text: string; at: string } | null;
};

/** Operator notes: why a figure reads the way it does, each dated and cited, never editing the figure. */
function notesPanel(notes: NoteRow[], links: Links): string {
  const valid = notes.filter((note) => note.file !== null);
  if (valid.length === 0) {
    return '';
  }
  const rows = valid
    .map(
      (note) =>
        `<tr><td><code>${escapeHtml(note.file!.figure)}</code></td><td class="mono">${escapeHtml(note.file!.period ?? '')}</td><td>${escapeHtml(note.file!.text)}</td><td class="mono">${escapeHtml(note.file!.at.slice(0, 10))}</td><td>${cites('record', [note.path], links)}</td></tr>`,
    )
    .join('');
  return panel(
    'Notes',
    `<div class="scroll"><table><thead><tr><th>figure</th><th>period</th><th>note</th><th>written</th><th>cite</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    `${trustBadges(['reported'])} an operator's explanation of a figure, dated and committed; a note explains a number and never changes one`,
  );
}

/** Hours by operator and month, measured beside confirmed, with the specs the hours went to. */
function hoursPanel(hours: RepositorySignals['hours'], links: Links): string {
  const operators = Object.entries(hours.byOperator);
  if (operators.length === 0) {
    return panel(
      'Hours',
      '<p class="empty">No operator hours recorded yet.</p>',
      `${trustBadges(hours.trust)} ${escapeHtml(hours.note)}`,
    );
  }
  const rows = operators
    .flatMap(([operator, entry]) =>
      Object.entries(entry.byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([month, bucket]) =>
            `<tr><td><code>${escapeHtml(operator)}</code></td><td class="mono">${escapeHtml(month)}</td><td class="num">${bucket.measured.toFixed(1)} h</td><td class="num">${bucket.confirmed === null ? '<span class="dim">not closed</span>' : bucket.confirmed.toFixed(1) + ' h'}</td><td>${bucket.timesheet ? cites('timesheet', [bucket.timesheet], links) : '<span class="dim">timesheet close ' + escapeHtml(month) + '</span>'}</td></tr>`,
        ),
    )
    .join('');
  const specs = operators
    .map(
      ([operator, entry]) =>
        `<p class="help"><code>${escapeHtml(operator)}</code> by spec: ${escapeHtml(
          Object.entries(entry.bySpec)
            .sort(([, a], [, b]) => b - a)
            .map(([spec, h]) => `${spec} ${h.toFixed(1)} h`)
            .join(', '),
        )}</p>`,
    )
    .join('');
  return panel(
    'Hours',
    `${figure(`${hours.measured.toFixed(1)} h`, hours.confirmed > 0 ? `measured; ${hours.confirmed.toFixed(1)} h confirmed by timesheets` : 'measured; none confirmed by a timesheet yet')}<div class="scroll"><table><thead><tr><th>operator</th><th>month</th><th class="num">measured</th><th class="num">confirmed</th><th>timesheet</th></tr></thead><tbody>${rows}</tbody></table></div>${specs}`,
    `${trustBadges(hours.trust)} ${escapeHtml(hours.note)}`,
  );
}

/** Across the registry: one table per dimension, only when there is more than one repository to sum. */
function registrySection(projection: Projection | null): string {
  const rollup = projection?.registry;
  if (!rollup || rollup.repositories.length < 2) {
    return '';
  }
  const specRows = Object.entries(rollup.bySpec)
    .sort(
      ([, a], [, b]) => b.allocated + b.reported - (a.allocated + a.reported),
    )
    .map(
      ([spec, row]) =>
        `<tr><td><code>${escapeHtml(spec)}</code></td><td class="num">$${row.reported.toFixed(2)}</td><td class="num">${row.allocated > 0 ? escapeHtml(money(row.allocated, row.currency ?? 'USD')) : '<span class="dim">none</span>'}</td><td class="num">${row.hours > 0 ? row.hours.toFixed(1) + ' h' : '<span class="dim">none</span>'}</td><td class="num">${row.tokens.toLocaleString('en-US')}</td><td>${escapeHtml(row.repositories.join(', '))}</td></tr>`,
    )
    .join('');
  const classRows = Object.entries(rollup.byClass)
    .map(
      ([cls, row]) =>
        `<tr><td><code>${escapeHtml(cls)}</code></td><td class="num">$${row.reported.toFixed(2)}</td><td class="num">${row.allocated > 0 ? escapeHtml(money(row.allocated, row.currency ?? 'USD')) : '<span class="dim">none</span>'}</td><td class="num">${row.hours.toFixed(1)} h</td><td class="num">${row.sessions}</td></tr>`,
    )
    .join('');
  const hourRows = Object.entries(rollup.hours)
    .map(
      ([operator, row]) =>
        `<tr><td><code>${escapeHtml(operator)}</code></td><td class="num">${row.measured.toFixed(1)} h</td><td class="num">${row.confirmed.toFixed(1)} h</td><td>${escapeHtml(
          Object.entries(row.bySpec)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([spec, h]) => `${spec} ${h.toFixed(1)} h`)
            .join(', '),
        )}</td></tr>`,
    )
    .join('');
  return `<section class="repository" aria-label="All repositories"><h2 class="repo">All repositories <span class="branch">${escapeHtml(rollup.repositories.join(', '))}</span></h2>
<p class="meta">${escapeHtml(rollup.note)}</p>
<div class="grid wide">
${panel('Spend by spec, across the registry', `<div class="scroll"><table><thead><tr><th>spec</th><th class="num">reported</th><th class="num">allocated</th><th class="num">hours</th><th class="num">tokens</th><th>repositories</th></tr></thead><tbody>${specRows}</tbody></table></div>`, trustBadges(['reported', 'allocated']))}
${panel('Spend by cost class, across the registry', `<div class="scroll"><table><thead><tr><th>class</th><th class="num">reported</th><th class="num">allocated</th><th class="num">hours</th><th class="num">sessions</th></tr></thead><tbody>${classRows}</tbody></table></div>`, trustBadges(['reported', 'allocated']))}
${panel(
  'Hours, across the registry',
  `${figure(
    `${Object.values(rollup.hours)
      .reduce((sum, row) => sum + row.measured, 0)
      .toFixed(1)} h`,
    `measured; velocity ${rollup.velocity.complexity} complexity over ${rollup.velocity.changes} changes`,
  )}<div class="scroll"><table><thead><tr><th>operator</th><th class="num">measured</th><th class="num">confirmed</th><th>by spec</th></tr></thead><tbody>${hourRows}</tbody></table></div>`,
  trustBadges(['reported']),
)}
</div>
</section>`;
}

// --- Chrome ----------------------------------------------------------------------------------------

export function trustBadges(trust: string[]): string {
  return trust
    .map(
      (value) =>
        `<span class="badge badge-${escapeHtml(value)}">${escapeHtml(value)}</span>`,
    )
    .join(' ');
}

function excludedNote(excluded: Record<string, number>): string {
  const parts = Object.entries(excluded)
    .filter(([, value]) => value > 0)
    .map(([reason, value]) => `${value} ${reason}`);
  return parts.length ? `excluded: ${parts.join(', ')}` : 'excluded: none';
}

/**
 * One panel: title and trust classes, then the figure and whatever chart or table carries it, then a folded
 * "How it's measured" holding the methodology note, the excluded count, and the help text, then the
 * citations. Call sites pass the meta as badges followed by prose, so the split happens here rather than at
 * thirty call sites. Only a citation block that closes the body moves after the fold; one inside a table
 * row stays in its row.
 */
export function panel(
  title: string,
  body: string,
  meta = '',
  extraClass = '',
): string {
  const badges = /^((?:<span class="badge[^"]*">[^<]*<\/span>\s*)+)/.exec(meta);
  const trust = badges ? badges[1].trim() : '';
  const note = (badges ? meta.slice(badges[0].length) : meta).trim();
  const folded: string[] = [];
  let content = body.replace(
    /<p class="(?:help|meta)">[\s\S]*?<\/p>/g,
    (paragraph) => {
      folded.push(paragraph);
      return '';
    },
  );
  const trailing: string[] = [];
  const tail =
    /(?:<details class="cites">(?:(?!<\/details>)[\s\S])*<\/details>|<p class="cites-empty">[^<]*<\/p>)\s*$/;
  for (;;) {
    const match = tail.exec(content);
    if (!match) {
      break;
    }
    trailing.unshift(match[0].trim());
    content = content.slice(0, match.index);
  }
  const how =
    note || folded.length
      ? `<details class="how"><summary>How it's measured</summary>${note ? `<p class="meta">${note}</p>` : ''}${folded.join('')}</details>`
      : '';
  const foot =
    how || trailing.length
      ? `<div class="foot">${how}${trailing.join('')}</div>`
      : '';
  return `<section class="panel${extraClass ? ' ' + extraClass : ''}"><div class="head"><h3>${escapeHtml(title)}</h3>${trust ? `<span class="trust">${trust}</span>` : ''}</div>${content}${foot}</section>`;
}

function figure(value: string, unit: string): string {
  return `<p class="figure">${value}<span class="unit">${unit}</span></p>`;
}

// --- Charts ----------------------------------------------------------------------------------------

type Bar = { label: string; value: number | null; display: string };

/** A horizontal bar chart with a zero line and a scale label, sized in the viewBox and fluid in width. */
function barChart(bars: Bar[], caption: string): string {
  const row = 24;
  const left = 64;
  const right = 78;
  const width = 360;
  const track = width - left - right;
  const scale = Math.max(1, ...bars.map((bar) => bar.value ?? 0));
  const scaleLabel =
    bars.find((bar) => bar.value === scale)?.display ?? String(scale);
  const height = row * bars.length + 14;
  const gridlines = [0.25, 0.5, 0.75, 1]
    .map(
      (fraction) =>
        `<line class="gridline" x1="${left + track * fraction}" y1="0" x2="${left + track * fraction}" y2="${row * bars.length}"></line>`,
    )
    .join('');
  const rows = bars
    .map((bar, index) => {
      const length =
        bar.value === null || bar.value === 0
          ? 0
          : Math.max(3, Math.round((bar.value / scale) * track));
      const y = index * row;
      return `<text x="0" y="${y + 16}" class="tick">${escapeHtml(bar.label)}</text><rect x="${left}" y="${y + 5}" width="${length}" height="14" rx="4" class="bar"></rect><text x="${left + length + 6}" y="${y + 16}" class="value">${escapeHtml(bar.display)}</text>`;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${escapeHtml(caption)}">${gridlines}<line class="axis" x1="${left}" y1="0" x2="${left}" y2="${row * bars.length}"></line>${rows}<text x="${left}" y="${height - 2}" class="tick">0</text><text x="${left + track}" y="${height - 2}" class="tick" text-anchor="end">${escapeHtml(scaleLabel)}</text></svg>`;
}

/** Columns over time: one column per bucket, a few dated ticks, no axis library. */
/**
 * Velocity over the window: story points per week as columns. Weeks whose changes recorded no points render
 * as a gap rather than a zero column, because an unmeasured week and an empty week are different facts.
 */
function velocityChart(weekly: WeeklyBucket[]): string {
  if (weekly.length === 0) {
    return '';
  }
  return columnChart(
    weekly.map((week) => ({ label: week.week, value: week.complexity })),
    'relative complexity of tasks completed per week over the measured window',
  );
}

function columnChart(
  buckets: { label: string; value: number }[],
  caption: string,
): string {
  const width = 360;
  const height = 96;
  const floor = height - 16;
  const top = 6;
  const scale = Math.max(1, ...buckets.map((bucket) => bucket.value));
  const step = width / Math.max(1, buckets.length);
  const barWidth = Math.max(1.5, Math.min(14, step - 1.5));
  const columns = buckets
    .map((bucket, index) => {
      const length = Math.round(((bucket.value / scale) * (floor - top)) / 1);
      const x = index * step + (step - barWidth) / 2;
      return `<rect x="${x.toFixed(1)}" y="${floor - length}" width="${barWidth.toFixed(1)}" height="${Math.max(bucket.value > 0 ? 2 : 0, length)}" rx="1.5" class="bar"></rect>`;
    })
    .join('');
  const ticks = [0, Math.floor(buckets.length / 2), buckets.length - 1]
    .filter(
      (index, position, all) => index >= 0 && all.indexOf(index) === position,
    )
    .map((index) => {
      const x = index * step + step / 2;
      const anchor =
        index === 0 ? 'start' : index === buckets.length - 1 ? 'end' : 'middle';
      return `<text x="${x.toFixed(1)}" y="${height - 3}" class="tick" text-anchor="${anchor}">${escapeHtml(buckets[index]?.label ?? '')}</text>`;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${escapeHtml(caption)}"><line class="axis" x1="0" y1="${floor}" x2="${width}" y2="${floor}"></line>${columns}${ticks}</svg>`;
}

/** Insertions above the line, deletions below it, one column per change, newest last. */
function diffChart(
  changes: { insertions: number; deletions: number }[],
  caption: string,
): string {
  const width = 360;
  const height = 92;
  const middle = height / 2;
  const scale = Math.max(
    1,
    ...changes.map((change) => Math.max(change.insertions, change.deletions)),
  );
  const step = width / Math.max(1, changes.length);
  const barWidth = Math.max(2, Math.min(16, step - 2));
  const columns = changes
    .map((change, index) => {
      const x = index * step + (step - barWidth) / 2;
      const up = Math.round((change.insertions / scale) * (middle - 12));
      const down = Math.round((change.deletions / scale) * (middle - 12));
      return `<rect x="${x.toFixed(1)}" y="${middle - up}" width="${barWidth.toFixed(1)}" height="${Math.max(change.insertions > 0 ? 2 : 0, up)}" rx="1.5" class="bar"></rect><rect x="${x.toFixed(1)}" y="${middle}" width="${barWidth.toFixed(1)}" height="${Math.max(change.deletions > 0 ? 2 : 0, down)}" rx="1.5" class="bar bar-alt"></rect>`;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${escapeHtml(caption)}"><line class="axis" x1="0" y1="${middle}" x2="${width}" y2="${middle}"></line>${columns}</svg>`;
}

/** A proportion of the largest value in a column, drawn behind the number with no extra element. */
function meter(value: number, largest: number): string {
  const percent = largest > 0 ? Math.round((value / largest) * 100) : 0;
  return `<span class="meter"><span class="meter-fill" style="width:${percent}%"></span></span>`;
}

function distributionPanel(
  title: string,
  distribution: Distribution,
  help: string,
  links: Links,
): string {
  const meta = `${trustBadges(distribution.trust)} over ${count(distribution.count, 'change')} · ${escapeHtml(excludedNote(distribution.excluded))}`;
  if (distribution.count === 0) {
    return panel(
      title,
      `<p class="empty">No change with a pull head ref yet, so nothing to time.</p>`,
      meta,
    );
  }
  const bars: Bar[] = [
    {
      label: 'typical',
      value: distribution.p50,
      display: seconds(distribution.p50),
    },
    {
      label: '9 in 10',
      value: distribution.p90,
      display: seconds(distribution.p90),
    },
    {
      label: 'slowest',
      value: distribution.max,
      display: seconds(distribution.max),
    },
  ];
  const body = `${figure(seconds(distribution.p50), 'typical')}${barChart(bars, 'typical, nine in ten, and slowest')}<p class="help">Typical is the median: half the changes were faster, half slower. Nine in ten changes came in under the second bar. The third is the slowest one. ${escapeHtml(help)}</p>${cites('changes', distribution.cites, links)}`;
  return panel(title, body, meta);
}

function spendRow(
  label: string,
  spend: Spend,
  largest: number,
  links: Links,
  allocated: string,
): string {
  const blank = '<span class="dim">–</span>';
  return `<tr><td>${escapeHtml(label)}</td><td class="num">${spend.costUsd > 0 ? meter(spend.costUsd, largest) : ''}${reportedCost(spend.costUsd, spend.sessions)}</td><td class="num nowrap">${allocated.trim() || '<span class="dim">none</span>'}</td><td class="num">${spend.sessions > 0 ? (spend.inputTokens + spend.outputTokens).toLocaleString('en-US') : blank}</td><td class="num">${spend.sessions > 0 ? spend.cachedTokens.toLocaleString('en-US') : blank}</td><td class="num">${spend.sessions > 0 ? spend.sessions : blank}</td><td>${cites('records', spend.cites, links)}</td></tr>`;
}

function spendTable(
  title: string,
  rows: Record<string, Spend>,
  missingFigures: number,
  links: Links,
  allocation: Allocation,
  allocatedRows: (
    aggregates: Allocation['currencies'][string],
  ) => Record<string, AllocatedSpend>,
): string {
  const entries = Object.entries(rows);
  const key = title.replace('Spend by ', '');
  const meta = `${trustBadges(['reported', 'allocated'])} keyed to ${escapeHtml(key)}, never to a person; reported cost beside the allocated subscription share`;
  // A label with an allocated share but no reported figures still gets a row: the share is a figure.
  for (const aggregates of Object.values(allocation.currencies)) {
    for (const label of Object.keys(allocatedRows(aggregates))) {
      if (!rows[label]) {
        entries.push([
          label,
          {
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            costUsd: 0,
            operatorSeconds: 0,
            agentAutonomousSeconds: 0,
            withoutOperatorTime: 0,
            sessions: 0,
            cites: [],
          },
        ]);
      }
    }
  }
  if (entries.length === 0) {
    const note =
      missingFigures > 0
        ? `${missingFigures} session records carry no figures (the harness did not supply them), so there is nothing to total.`
        : 'No session records with figures.';
    return panel(title, `<p class="empty">${escapeHtml(note)}</p>`, meta);
  }
  const sorted = entries.sort(([, a], [, b]) => b.costUsd - a.costUsd);
  const largest = sorted[0][1].costUsd;
  const body = sorted
    .map(([label, spend]) =>
      spendRow(
        label,
        spend,
        largest,
        links,
        allocatedCell(
          allocation,
          (aggregates) => allocatedRows(aggregates)[label],
        ),
      ),
    )
    .join('');
  return panel(
    title,
    `<div class="scroll"><table><thead><tr><th>${escapeHtml(key)}</th><th class="num">cost</th><th class="num">allocated</th><th class="num">tokens</th><th class="num">cached</th><th class="num">sessions</th><th>cites</th></tr></thead><tbody>${body}</tbody></table></div>`,
    meta,
  );
}

/**
 * The operator dimension: two tables, never one. Agents carry currency and tokens, humans carry hours, and
 * there is deliberately no total row across them — no record in this repository holds a rate, so a combined
 * figure could only be invented. Each human operator is its pseudonymous identifier and nothing else.
 */
/** Work mix: what each week shipped, by conventional commit type, as stacked shares. */
function workMixPanel(signals: RepositorySignals, links: Links): string {
  const weeks = Object.keys(signals.workMix.weekly).sort();
  const totals: Record<string, number> = {};
  for (const week of weeks) {
    for (const [type, entry] of Object.entries(signals.workMix.weekly[week])) {
      totals[type] = (totals[type] ?? 0) + entry.changes;
    }
  }
  const ranked = Object.entries(totals).sort(([, a], [, b]) => b - a);
  const overall = ranked.reduce((sum, [, count]) => sum + count, 0);
  const rows = ranked
    .map(
      ([type, count]) =>
        `<tr><td>${escapeHtml(type)}</td><td class="num">${count}</td><td class="num">${overall > 0 ? Math.round((count / overall) * 100) : 0}%</td><td>${cites(
          'changes',
          Object.values(signals.workMix.weekly).flatMap(
            (week) => week[type]?.cites ?? [],
          ),
          links,
        )}</td></tr>`,
    )
    .join('');
  return panel(
    'Work mix',
    rows
      ? `<div class="scroll"><table><thead><tr><th>type</th><th class="num">changes</th><th class="num">share</th><th>cites</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p class="empty">No changes in the window.</p>',
    `${trustBadges(['observed'])} ${escapeHtml(signals.workMix.note)}`,
  );
}

/** Flow efficiency, iterations, spec lead time, and check compliance: four small reads, returned apart. */
function efficiencyPanels(
  signals: RepositorySignals,
  links: Links,
): {
  efficiency: string;
  iterations: string;
  specLeadTime: string;
  compliance: string;
} {
  const percent = (value: number | null) =>
    value === null ? 'n/a' : `${Math.round(value * 100)}%`;
  const compliance = signals.checkCompliance;
  const efficiency = panel(
    'Flow efficiency',
    `${figure(percent(signals.flowEfficiency.p50), `typical share of cycle time someone was working; ${count(signals.flowEfficiency.count, 'change')} measured`)}<p class="help">Active seconds are the agent's run time plus the operator's active time, counted only where the session window overlaps the cycle window; ${escapeHtml(seconds(signals.flowEfficiency.outsideSeconds))} of active time fell outside any change's window and is reported here rather than hidden${
      Object.keys(signals.flowEfficiency.outsideBySpec).length
        ? `: ${escapeHtml(
            Object.entries(signals.flowEfficiency.outsideBySpec)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([spec, secs]) => `${spec} ${seconds(secs)}`)
              .join(', '),
          )}`
        : ''
    }.</p>${cites('changes', signals.flowEfficiency.cites, links)}`,
    `${trustBadges(signals.flowEfficiency.trust)} ${escapeHtml(excludedNote(signals.flowEfficiency.excluded))}`,
  );
  const iterations = panel(
    'Iterations',
    `${figure(String(signals.iterations.sessionsPerChange.p50 ?? 'n/a'), `typical sessions per change; ${signals.iterations.commitsPerChange.p50 ?? 'n/a'} commits per change`)}`,
    `${trustBadges(['observed', 'reported'])} over ${count(signals.iterations.sessionsPerChange.count, 'change')}`,
  );
  const specLeadTime = panel(
    'Spec lead time',
    `${figure(escapeHtml(seconds(signals.specLeadTime.p50)), `typical, from a spec's first commit to the merge that archived it; ${count(signals.specLeadTime.count, 'spec')} measured`)}${cites('specs', signals.specLeadTime.cites, links)}`,
    `${trustBadges(signals.specLeadTime.trust)} ${escapeHtml(excludedNote(signals.specLeadTime.excluded))}`,
  );
  const compliancePanel = panel(
    'Check compliance',
    `${figure(percent(compliance.recordedShare), `of ${count(compliance.changes, 'change')} recorded a local check; ${percent(compliance.passRate)} of those passed`)}<p class="help">The share matters more than the rate: a high pass rate over a tenth of the changes says very little.</p>`,
    trustBadges(compliance.trust),
  );
  return { efficiency, iterations, specLeadTime, compliance: compliancePanel };
}

/**
 * The metered rate beside the allocated one, never summed with it: one is a cost the harness reported, the
 * other a consequence of an allocation basis this repository chose. Never combined across providers either,
 * because two providers' token counts are not the same measurement.
 */
function meteredRatePanel(
  rates: RepositorySignals['meteredRates'],
  links: Links,
): string {
  if (rates.length === 0) {
    return '';
  }
  const rows = rates
    .map((rate) => {
      const figure =
        rate.perMillionInputOutput === null
          ? '<span class="dim">no tokens reported</span>'
          : escapeHtml(money(rate.perMillionInputOutput, rate.currency));
      const missing =
        rate.withoutTokens > 0
          ? ` <span class="dim">${rate.withoutTokens} reporting none</span>`
          : '';
      const cache =
        rate.cacheComponentsUnknown && rate.cachedTokens > 0
          ? ' <span class="dim">cache components unknown for some records</span>'
          : '';
      return `<tr><td>${escapeHtml(rate.provider)}</td><td class="mono">${escapeHtml(rate.currency)}</td><td class="num">${figure}</td><td class="num">${rate.inputOutputTokens.toLocaleString('en-US')}</td><td class="num">${rate.sessions}${missing}</td><td>${cache}${cites('records', rate.cites, links)}</td></tr>`;
    })
    .join('');
  return panel(
    'Metered spend per token',
    `<div class="scroll"><table><thead><tr><th>provider</th><th>currency</th><th class="num">per million in+out</th><th class="num">tokens</th><th class="num">sessions</th><th>cites</th></tr></thead><tbody>${rows}</tbody></table></div><p class="meta">Reported cost over reported tokens, so no apportioning is involved. Never summed with the allocated rate and never sharing a denominator across providers.</p>`,
    `${trustBadges(['reported'])} one row per provider and currency`,
  );
}

function operatorPanel(operators: Operators, links: Links): string {
  const agents = Object.entries(operators.agents).sort(
    ([, a], [, b]) => b.sessions - a.sessions,
  );
  const humans = Object.entries(operators.humans).sort(
    ([, a], [, b]) => b.hours - a.hours,
  );

  const money = (agent: Operators['agents'][string]): string => {
    const parts = Object.entries(agent.currencies).map(
      ([currency, amount]) =>
        `${currency === 'USD' ? '$' : ''}${(amount.amount + amount.overage).toFixed(2)}${currency === 'USD' ? '' : ' ' + escapeHtml(currency)}`,
    );
    if (parts.length === 0) {
      return '<span class="dim">no subscription period</span>';
    }
    return `${parts.join(' ')}${agent.provisional ? ' <span class="dim">provisional</span>' : ''}`;
  };

  const agentRows =
    agents
      .map(
        ([key, agent]) =>
          `<tr><td>${escapeHtml(key)}</td><td class="num">${money(agent)}</td><td class="num">${(agent.inputTokens + agent.outputTokens).toLocaleString('en-US')}</td><td class="num">${agent.sessions}</td><td>${cites('records', agent.cites, links)}</td></tr>`,
      )
      .join('') ||
    '<tr><td colspan="5" class="dim">no agent session recorded</td></tr>';

  const humanRows =
    humans
      .map(
        ([id, human]) =>
          `<tr><td>${escapeHtml(id)}</td><td class="num">${human.hours.toFixed(1)} h</td><td class="num">${human.sessions}</td><td>${cites('records', human.cites, links)}</td></tr>`,
      )
      .join('') ||
    '<tr><td colspan="4" class="dim">no operator hours recorded yet</td></tr>';

  const excluded = [
    `${operators.excluded.humanOnly} human-only`,
    `${operators.excluded.noOperator} without an operator identifier`,
  ].join(', ');

  return panel(
    'Spend by operator',
    `<div class="scroll"><table><thead><tr><th>agent</th><th class="num">allocated</th><th class="num">tokens</th><th class="num">sessions</th><th>cites</th></tr></thead><tbody>${agentRows}</tbody></table></div>` +
      `<div class="scroll"><table><thead><tr><th>operator</th><th class="num">hours</th><th class="num">sessions</th><th>cites</th></tr></thead><tbody>${humanRows}</tbody></table></div>` +
      `<p class="meta">Hours and currency are different units and are never summed; no rate exists in any record to convert one into the other.</p>`,
    `${trustBadges(operators.trust)} agents in the subscription's currency and tokens, humans in hours, each identified by a pseudonymous identifier alone; excluded: ${escapeHtml(excluded)} (counted, never zeroed)`,
  );
}

type ChangeRow = {
  id: string;
  subject: string;
  kind: string;
  mergeTime: string;
  association: {
    pullRequest: number | null;
    method: string | null;
    classification: string;
  };
  timing: {
    cycleTimeSeconds: number | null;
    waitTimeSeconds: number | null;
    reason: string | null;
  };
  sessions: { status: string; sessions: string[]; unreported: string[] };
  gaps: { type: string }[];
  insertions: number;
  deletions: number;
  files: number;
};

function changesTable(
  changes: ChangeRow[],
  byChange: Record<string, Spend>,
  links: Links,
  allocation: Allocation,
): string {
  const recent = [...changes].reverse().slice(0, 15);
  const rows = recent
    .map((change) => {
      const sessions =
        change.sessions.status === 'declared'
          ? change.sessions.sessions.length
            ? change.sessions.sessions
                .map((id) => sessionRef(id, links))
                .join(' ')
            : `<span class="warn">unreported</span>`
          : `<span class="${change.sessions.status === 'undeclared' ? 'warn' : 'dim'}">${escapeHtml(change.sessions.status)}</span>`;
      // No entry in byChange is never zero: it is whatever the records failed to say.
      const absent =
        change.sessions.status !== 'declared'
          ? change.sessions.status
          : change.sessions.sessions.length === 0
            ? 'unreported'
            : 'figures missing';
      const spend = `${spendCell(byChange[change.id], absent)}${allocatedCell(allocation, (aggregates) => aggregates.byChange[change.id])}`;
      const gaps = change.gaps
        .map((gap) => `<span class="gap">${escapeHtml(gap.type)}</span>`)
        .join(' ');
      const more = `<span class="added">+${change.insertions}</span> <span class="removed">−${change.deletions}</span> over ${count(change.files, 'file')} · sessions ${sessions} · gaps ${gaps || '<span class="dim">none</span>'}`;
      return `<tr><td class="mono">${escapeHtml(dateOnly(change.mergeTime))}</td><td class="subject">${href(links, `commit/${change.id}`, change.id.slice(0, 10))} <span class="cite-title">${escapeHtml(change.subject)}</span></td><td>${pullRef(change.association.pullRequest, links)} <span class="dim">${escapeHtml(change.association.method ?? '')}</span></td><td class="num">${escapeHtml(seconds(change.timing.waitTimeSeconds))}</td><td class="num">${escapeHtml(seconds(change.timing.cycleTimeSeconds))}</td><td class="num nowrap">${spend}</td><td class="num nowrap">${hoursCell(byChange[change.id])}</td><td><details class="more"><summary>more</summary><p class="more-body">${more}</p></details></td></tr>`;
    })
    .join('');
  return panel(
    'Recent changes',
    `<div class="scroll tall"><table class="changes"><thead><tr><th>merged</th><th>change</th><th>pull request</th><th class="num">wait</th><th class="num">cycle</th><th class="num">spend</th><th class="num">man hours</th><th>lines, sessions, gaps</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    `${trustBadges(['observed', 'reported'])} the newest ${recent.length} of ${changes.length} changes on the default branch; wait and cycle come from the pull head ref, sessions and spend from the harness; lines, sessions, and gaps disclose per row`,
    'span-all',
  );
}

/** One bucket per day between the first and last merge, or per week when that is more than 60 columns. */
function mergeBuckets(changes: ChangeRow[]): {
  buckets: { label: string; value: number }[];
  period: string;
  first: string;
  last: string;
} | null {
  const days = changes
    .map((change) => dateOnly(change.mergeTime))
    .filter((day) => day !== 'unknown')
    .sort();
  if (days.length === 0) {
    return null;
  }
  const start = Date.parse(`${days[0]}T00:00:00Z`);
  const end = Date.parse(`${days[days.length - 1]}T00:00:00Z`);
  const span = Math.round((end - start) / 86_400_000) + 1;
  const perBucket = span > 60 ? 7 : 1;
  const bucketCount = Math.ceil(span / perBucket);
  const buckets = Array.from({ length: bucketCount }, (unused, index) => ({
    label: new Date(start + index * perBucket * 86_400_000)
      .toISOString()
      .slice(5, 10),
    value: 0,
  }));
  for (const day of days) {
    const offset = Math.round(
      (Date.parse(`${day}T00:00:00Z`) - start) / 86_400_000,
    );
    buckets[Math.floor(offset / perBucket)].value += 1;
  }
  return {
    buckets,
    period: perBucket === 1 ? 'day' : 'week',
    first: days[0],
    last: days[days.length - 1],
  };
}

function mergeActivity(changes: ChangeRow[]): string {
  const merged = mergeBuckets(changes);
  if (!merged) {
    return '';
  }
  const peak = Math.max(...merged.buckets.map((bucket) => bucket.value));
  return `${columnChart(merged.buckets, 'changes merged over the measured window')}<p class="help">${escapeHtml(
    `One column per ${merged.period} from ${merged.first} to ${merged.last}; busiest ${merged.period}, ${count(peak, 'change')}.`,
  )}</p>`;
}

/** A trend beside a headline figure: columns in a small box, the last one emphasised. */
function spark(values: (number | null)[], caption: string): string {
  const width = 120;
  const height = 28;
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) {
    return '';
  }
  const scale = Math.max(1, ...present);
  const step = width / Math.max(1, values.length);
  const barWidth = Math.max(1.5, Math.min(8, step - 1.5));
  const columns = values
    .map((value, index) => {
      if (value === null) {
        return '';
      }
      const length = Math.max(
        value > 0 ? 2 : 0,
        Math.round((value / scale) * height),
      );
      const x = index * step + (step - barWidth) / 2;
      const last = index === values.length - 1;
      return `<rect x="${x.toFixed(1)}" y="${height - length}" width="${barWidth.toFixed(1)}" height="${length}" rx="1" class="${last ? 'bar' : 'bar-soft'}"></rect>`;
    })
    .join('');
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${escapeHtml(caption)}">${columns}</svg>`;
}

function topFiles(pairs: { files: string[] }[], limit = 6): string {
  const counts = new Map<string, number>();
  for (const pair of pairs) {
    for (const file of pair.files) {
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) {
    return '';
  }
  const largest = top[0][1];
  return `<ul class="list ranked">${top
    .map(
      ([file, value]) =>
        `<li>${meter(value, largest)}<code>${escapeHtml(file)}</code> <span class="dim">${escapeHtml(`in ${count(value, 'pair')}`)}</span></li>`,
    )
    .join('')}</ul>`;
}

/** The four DORA reads as panels, each with its approximation note and its citations. */
function doraPanels(signals: RepositorySignals, links: Links): string[] {
  const dora = signals.dora;
  const cards: {
    label: string;
    value: string;
    unit: string;
    note: string;
    cites: string;
    excluded?: string;
  }[] = [
    {
      label: 'Deployment frequency',
      value:
        dora.deploymentFrequency.perWeek === null
          ? 'n/a'
          : String(dora.deploymentFrequency.perWeek),
      unit: `releases / week; ${count(dora.deploymentFrequency.releases, 'release')} over ${dora.deploymentFrequency.days ?? 'n/a'} days`,
      note: `${dora.deploymentFrequency.note}.`,
      cites: dora.deploymentFrequency.tags.length
        ? `<details class="cites"><summary>tags: ${dora.deploymentFrequency.tags.length}</summary><ul>${dora.deploymentFrequency.tags.map((tag) => `<li><code>${escapeHtml(tag)}</code></li>`).join('')}</ul></details>`
        : '<p class="cites-empty">cites: none</p>',
    },
    {
      label: 'Lead time to release',
      value: seconds(dora.leadTimeToRelease.p50),
      unit: `lead time to release, typical, over ${count(dora.leadTimeToRelease.count, 'released change')}`,
      note: `Of that, ${seconds(dora.leadTimeToRelease.mergeToTag.p50)} typical from merge to tag. ${dora.leadTimeToRelease.note}.`,
      cites: cites('changes', dora.leadTimeToRelease.cites, links),
      excluded: excludedNote(dora.leadTimeToRelease.excluded),
    },
    {
      label: 'Change failure rate',
      value:
        dora.changeFailureRate.perRelease === null
          ? 'n/a'
          : String(dora.changeFailureRate.perRelease),
      unit: `escapes / release; ${count(dora.changeFailureRate.escapes, 'escape')} over ${count(dora.changeFailureRate.releases, 'release')}`,
      note: `${dora.changeFailureRate.note}.`,
      cites: cites('escapes', dora.changeFailureRate.cites, links),
    },
    {
      label: 'Time to fix',
      value: seconds(dora.timeToFix.p50),
      unit: `time to fix, typical, over ${count(dora.timeToFix.count, 'escape')}`,
      note: `${dora.timeToFix.note}.`,
      cites: cites('fixes', dora.timeToFix.cites, links),
      excluded: excludedNote(dora.timeToFix.excluded),
    },
  ];
  return cards.map((card) =>
    panel(
      card.label,
      `${figure(escapeHtml(card.value), escapeHtml(card.unit))}<p class="help">${escapeHtml(card.note)}</p>${card.cites}`,
      `${trustBadges(['observed'])} computed from release tags because deployments are not observed here${card.excluded ? '; ' + escapeHtml(card.excluded) : ''}`,
    ),
  );
}

function spendOverTime(trends: RepositorySignals['trends']): string {
  const weeks = trends.weekly;
  if (weeks.length === 0) {
    return panel(
      'Spend over time',
      '<p class="empty">No merged changes yet.</p>',
      trustBadges(['reported']),
    );
  }
  const reported = weeks.reduce((sum, week) => sum + week.costUsd, 0);
  const allocated = weeks.reduce((sum, week) => sum + week.allocated, 0);
  // Reported cost leads when there is any; on a subscription there is none, so the allocated share leads
  // and the badge says so. Neither is ever drawn as a zero.
  const useAllocated = reported === 0 && allocated > 0;
  const pick = (week: WeeklyBucket) =>
    useAllocated ? week.allocated : week.costUsd;
  const total = useAllocated ? allocated : reported;
  if (total === 0) {
    return panel(
      'Spend over time',
      '<p class="empty">No cost reported or allocated yet.</p>',
      trustBadges(['reported', 'allocated']),
    );
  }
  const peak = Math.max(...weeks.map(pick));
  return panel(
    'Spend over time',
    `${figure(`$${total.toFixed(2)}`, `${useAllocated ? 'allocated' : 'reported'} across ${count(weeks.length, 'week')}; busiest week $${peak.toFixed(2)}`)}${columnChart(
      weeks.map((week) => ({ label: week.week.slice(5), value: pick(week) })),
      `${useAllocated ? 'allocated' : 'reported'} cost per week`,
    )}<p class="help">${escapeHtml(trends.note)}.</p>`,
    trustBadges([useAllocated ? 'allocated' : 'reported']),
  );
}

function costClassPanel(
  costClasses: CostClassSpend,
  coverage: Coverage,
  links: Links,
): string {
  const entries = Object.entries(costClasses).sort(
    ([, a], [, b]) => b.costUsd - a.costUsd,
  );
  const largest = entries[0]?.[1].costUsd ?? 0;
  const rows = entries
    .map(
      ([name, spend]) =>
        `<tr><td><code>${escapeHtml(name)}</code></td><td class="num">${spend.costUsd > 0 ? meter(spend.costUsd, largest) : ''}${reportedCost(spend.costUsd, spend.sessions)}</td><td class="num">${spend.allocated > 0 ? escapeHtml(money(spend.allocated, spend.currency ?? 'USD')) : '<span class="dim">none</span>'}</td><td class="num">${spend.hours > 0 ? spend.hours.toFixed(1) + ' h' : '<span class="dim">none</span>'}</td><td class="num">${spend.sessions}</td><td class="num">${spend.missingFigures}</td><td class="dim">${escapeHtml(
          Object.entries(spend.sources)
            .map(([source, n]) => `${n} ${source}`)
            .join(', '),
        )}</td><td>${cites('records', spend.cites, links)}</td></tr>`,
    )
    .join('');
  const table = rows
    ? `<div class="scroll"><table><thead><tr><th>class</th><th class="num">reported</th><th class="num">allocated</th><th class="num">hours</th><th class="num">sessions</th><th class="num">no figures</th><th>declared by</th><th>cites</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<p class="empty">No session records yet.</p>';
  const coverageLine = `${coverage.agent} with an agent session, ${coverage.humanOnly} human-only, ${coverage.undeclared} undeclared, ${coverage.unreported} unreported, of ${count(coverage.total, 'change')}`;
  return panel(
    'Spend by cost class',
    `${table}<p class="help">Coverage: ${escapeHtml(coverageLine)}.</p>`,
    `${trustBadges(['reported', 'allocated'])} the session's own class, then the change's Cost-Class trailer, then the spec's declared class, then the release rule (work a release tag carries, and work none does), then the repository's declared default; nothing is inferred. Declare with telemetry class set`,
  );
}

export function renderRepositoryHtml(repository: RepositoryProjection): string {
  const links = linksFor(repository);
  const home =
    repository.webUrl === null
      ? ''
      : ` <a class="ref home" href="${escapeHtml(repository.webUrl)}">${escapeHtml(repository.webUrl.replace(/^https:\/\//, ''))}</a>`;
  const label = `${escapeHtml(repository.name)}-heading`;
  const heading = `<h2 class="repo" id="${escapeHtml(repository.name)}"><span id="${label}">${escapeHtml(repository.name)}</span> <span class="branch">${escapeHtml(repository.defaultBranch)}</span>${home}</h2>`;
  const open = `<section class="repository" aria-labelledby="${label}">`;
  if (!repository.reachable) {
    return `${open}${heading}<p class="warn">Unreachable: ${escapeHtml(repository.reason ?? 'unknown reason')}</p></section>`;
  }
  const signals = repository.signals!;
  if (repository.changes.length === 0) {
    return `${open}${heading}<p class="empty">No changes on the default branch yet. Merge a pull request through the hooks, then sync and rebuild.</p></section>`;
  }
  const changes = repository.changes as unknown as ChangeRow[];
  const outOfBand = changes.filter(
    (change) => change.association.classification === 'out-of-band',
  );
  const excluded = signals.spend.excluded;
  const signalPanels = signals.signals
    .map(
      (signal) =>
        `<section class="panel signal"><div class="head"><h3>Signal: ${escapeHtml(signal.signal)}</h3></div><p class="figure">${escapeHtml(seconds(signal.observed))}<span class="unit">observed, over the registry threshold of ${escapeHtml(seconds(signal.threshold))}</span></p><div class="foot">${cites('changes', signal.cites, links)}</div></section>`,
    )
    .join('');
  const queueEntries = [...signals.queue.pullRequests]
    .map((entry) => ({
      ...entry,
      age: ageFrom(repository.asOf, entry.oldestCommitAt),
    }))
    .sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
  const queueChart = queueEntries.length
    ? barChart(
        queueEntries.slice(0, 8).map((entry) => ({
          label: `#${entry.number}`,
          value: entry.age,
          display: seconds(entry.age),
        })),
        'age of each unmerged pull request',
      )
    : '';
  const queueRows = queueEntries
    .map((entry) => {
      const perPull =
        signals.spend.perUnmergedPullRequest[String(entry.number)];
      const absent =
        perPull === undefined
          ? 'no session record'
          : perPull.missingFigures > 0
            ? 'figures missing'
            : 'no figures';
      const records = perPull
        ? cites('records', perPull.cites, links)
        : '<span class="dim">none</span>';
      return `<tr><td>${pullRef(entry.number, links)}</td><td class="num">${escapeHtml(seconds(entry.age))}</td><td class="num">${entry.commits}</td><td class="num nowrap">${spendCell(perPull?.spend, absent)}${allocatedCell(signals.allocation, (aggregates) => aggregates.perUnmergedPullRequest[String(entry.number)])}</td><td class="num nowrap">${hoursCell(perPull?.spend)}</td><td class="num">${perPull?.spend.sessions ?? 0}</td><td class="mono">${escapeHtml(dateOnly(entry.oldestCommitAt))}</td><td>${records}</td></tr>`;
    })
    .join('');
  const excludedLine = nonZero([
    [excluded.undeclared, 'undeclared'],
    [excluded.unreported, 'unreported'],
    [excluded.humanOnly, 'human-only'],
    [excluded.invalidSession, 'invalid'],
    [excluded.missingFigures, 'with figures missing'],
  ]);
  const effortRows = Object.values(signals.spend.perEffortUnit)
    .map(
      (unit) =>
        `<tr><td>${escapeHtml(unit.unit)}</td><td class="num">${unit.allocatedPerUnit === null ? '<span class="dim">none</span>' : escapeHtml(preciseMoney(unit.allocatedPerUnit, unit.currency ?? 'USD'))}</td><td class="num">${unit.costPerUnit === null || unit.costPerUnit === 0 ? '<span class="dim">none</span>' : '$' + unit.costPerUnit.toFixed(4)}</td><td class="num">${unit.changes > 0 ? unit.changes : '<span class="dim">none</span>'}</td><td class="num">${unit.excluded}</td><td>${cites('changes', unit.cites, links)}</td></tr>`,
    )
    .join('');
  const checks = Object.entries(signals.localChecks)
    .map(([outcome, value]) => `${value} ${escapeHtml(outcome)}`)
    .join(', ');
  const recentDiffs = [...changes].slice(-24);
  const unmergedExcluded = signals.spend.unmergedPullRequests.excluded;
  const excludedUnmerged = nonZero([
    [unmergedExcluded.missingFigures, 'with figures missing'],
    [unmergedExcluded.invalidSession, 'unreadable'],
  ]);
  const view = (name: string) => `${label}-${name}`;
  const reads = efficiencyPanels(signals, links);

  // --- Headline: one sentence in words, then five figures with a trend beside each. Every figure is the
  // value its panel shows and links to the sub-view holding that panel; nothing here is computed anew.
  const percent = (value: number | null) =>
    value === null ? 'n/a' : `${Math.round(value * 100)}%`;
  const link = (name: string, text: string) =>
    `<a href="#${view(name)}"><strong>${escapeHtml(text)}</strong></a>`;
  const reported = signals.spend.total.costUsd;
  const allocated = allocatedTotal(signals.allocation);
  const hasAllocated = /\d/.test(allocated);
  const spendSentence =
    reported > 0
      ? `Reported spend is ${link('economics-spend', `$${reported.toFixed(2)}`)}${hasAllocated ? ` beside ${link('economics-spend', allocated)} allocated from the plan` : ''}.`
      : hasAllocated
        ? `The plan has cost ${link('economics-spend', allocated)} so far, all of it allocated.`
        : 'No spend is reported or allocated yet.';
  const timing =
    signals.waitTime.p50 === null || signals.cycleTime.p50 === null
      ? `Over ${count(changes.length, 'change')} on ${escapeHtml(repository.defaultBranch)}, wait and cycle are not yet measured.`
      : `Over the last ${count(signals.cycleTime.count, 'change')}, finished work waits ${link('metrics-flow', seconds(signals.waitTime.p50))} before merge and a change takes ${link('metrics-flow', seconds(signals.cycleTime.p50))} end to end${
          signals.flowEfficiency.p50 === null
            ? ''
            : `; ${link('metrics-flow', percent(signals.flowEfficiency.p50))} of that time someone was working`
        }.`;
  const lede = `<p class="lede">${timing} ${spendSentence}</p>`;
  const kpi = (
    name: string,
    labelText: string,
    value: string,
    trust: string,
    trend: string,
    sub: string,
  ) =>
    `<a class="kpi" href="#${view(name)}"><span class="kpi-label">${escapeHtml(labelText)} ${trustBadges([trust])}</span><span class="kpi-value">${escapeHtml(value.replace(/ \(provisional\)/g, ''))}${value.includes('(provisional)') ? '<small>provisional</small>' : ''}</span>${trend}<span class="kpi-sub">${sub}</span></a>`;
  const distributionTrend = (
    distribution: RepositorySignals['waitTime'],
    caption: string,
  ) => spark([distribution.p50, distribution.p90, distribution.max], caption);
  const distributionSub = (distribution: RepositorySignals['waitTime']) =>
    distribution.count === 0
      ? 'nothing timed yet'
      : `9 in 10 under ${escapeHtml(seconds(distribution.p90))} · slowest ${escapeHtml(seconds(distribution.max))}`;
  const merged = mergeBuckets(changes);
  const spendWeeks = signals.trends.weekly;
  const spendTrend = spendWeeks.length
    ? spark(
        spendWeeks.map((week) =>
          reported > 0 ? week.costUsd : week.allocated,
        ),
        `${reported > 0 ? 'reported' : 'allocated'} spend per week`,
      )
    : '';
  const kpis = `<div class="kpis">${[
    kpi(
      'metrics-flow',
      'typical wait',
      seconds(signals.waitTime.p50),
      'observed',
      distributionTrend(
        signals.waitTime,
        'typical, nine in ten, and slowest wait',
      ),
      distributionSub(signals.waitTime),
    ),
    kpi(
      'metrics-flow',
      'typical cycle',
      seconds(signals.cycleTime.p50),
      'observed',
      distributionTrend(
        signals.cycleTime,
        'typical, nine in ten, and slowest cycle',
      ),
      distributionSub(signals.cycleTime),
    ),
    kpi(
      'records-queue',
      'waiting to merge',
      String(signals.queue.count),
      'observed',
      spark(
        queueEntries.slice(0, 8).map((entry) => entry.age),
        'age of each unmerged pull request',
      ),
      signals.queue.count === 0
        ? 'nothing waiting'
        : `oldest ${escapeHtml(seconds(signals.queue.oldestAgeSeconds))}`,
    ),
    kpi(
      'metrics-throughput',
      'merged per day',
      String(signals.mergeFrequency.perDay ?? 'n/a'),
      'observed',
      merged
        ? spark(
            merged.buckets.map((bucket) => bucket.value),
            'changes merged over the measured window',
          )
        : '',
      `${count(signals.mergeFrequency.changes, 'change')} over ${signals.mergeFrequency.days ?? 'n/a'} days`,
    ),
    kpi(
      'economics-spend',
      reported > 0 ? 'reported spend' : 'allocated spend',
      reported > 0
        ? `$${reported.toFixed(2)}`
        : hasAllocated
          ? allocated
          : signals.spend.total.sessions > 0
            ? 'none reported'
            : 'none',
      reported > 0 ? 'reported' : 'allocated',
      spendTrend,
      [
        reported > 0
          ? ''
          : signals.spend.total.sessions > 0
            ? 'no reported spend'
            : '',
        `${count(signals.spend.total.sessions, 'session')} with figures`,
        excluded.undeclared > 0
          ? `<span class="warn">${count(excluded.undeclared, 'change')} undeclared</span>`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    ),
  ].join('')}</div>`;

  // --- Groups: each answers one question; the column count says how the panels relate.
  const group = (
    question: string,
    subtitle: string,
    columns: number,
    panels: string[],
  ) =>
    `<div class="group"><div class="group-head"><h2 class="question">${escapeHtml(question)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><div class="grid c${columns}">${panels.filter(Boolean).join('\n')}</div></div>`;

  const spendTotal = panel(
    'Spend',
    `${figure(
      reported > 0
        ? `$${reported.toFixed(2)}`
        : `${(signals.spend.total.inputTokens + signals.spend.total.outputTokens).toLocaleString('en-US')} tokens`,
      reported > 0
        ? `${(signals.spend.total.inputTokens + signals.spend.total.outputTokens).toLocaleString('en-US')} tokens over ${signals.spend.total.sessions} sessions with figures`
        : `over ${signals.spend.total.sessions} sessions with figures; no reported cost, every session is on a subscription`,
    )}${cites('records', signals.spend.total.cites, links)}`,
    `${trustBadges(signals.spend.trust)} excluded: ${escapeHtml(excludedLine)} (counted, never zeroed)`,
  );
  const unmergedSpend =
    Object.keys(signals.spend.perUnmergedPullRequest).length > 0
      ? panel(
          'Spend on unmerged pull requests',
          `${figure(
            signals.spend.unmergedPullRequests.costUsd > 0
              ? `$${signals.spend.unmergedPullRequests.costUsd.toFixed(2)}`
              : `${(signals.spend.unmergedPullRequests.inputTokens + signals.spend.unmergedPullRequests.outputTokens).toLocaleString('en-US')} tokens`,
            `over ${count(signals.spend.unmergedPullRequests.sessions, 'session')} with figures, across ${count(Object.keys(signals.spend.perUnmergedPullRequest).length, 'pull request')}${signals.spend.unmergedPullRequests.costUsd > 0 ? '' : '; no reported cost'}`,
          )}${cites('records', signals.spend.unmergedPullRequests.cites, links)}`,
          `${trustBadges(['reported'])} excluded: ${escapeHtml(excludedUnmerged)} (counted, never zeroed)`,
        )
      : '';
  const notes = notesPanel(repository.notes as NoteRow[], links);

  return `${open}${heading}
<p class="asof">Measured as of ${escapeHtml(dateOnly(repository.asOf))}, the newest commit the mirror holds. Merge times are the merging party's clock.</p>
${lede}
${kpis}
<nav class="tabs" aria-label="Sections of ${escapeHtml(repository.name)}">
<div class="row top"><a class="top" href="#${view('metrics-flow')}">Metrics</a><a class="top" href="#${view('economics-spend')}">Economics</a><a class="top" href="#${view('records-changes')}">Records</a></div>
<div class="row sub sub-metrics"><a class="sub" href="#${view('metrics-flow')}">Flow</a><a class="sub" href="#${view('metrics-dora')}">DORA</a><a class="sub" href="#${view('metrics-throughput')}">Throughput</a></div>
<div class="row sub sub-economics"><a class="sub" href="#${view('economics-spend')}">Spend</a><a class="sub" href="#${view('economics-effort')}">Effort</a></div>
<div class="row sub sub-records"><a class="sub" href="#${view('records-changes')}">Changes <span class="n">${changes.length}</span></a><a class="sub" href="#${view('records-queue')}">Queue <span class="n">${signals.queue.count}</span></a><a class="sub" href="#${view('records-notes')}">Notes <span class="n">${(repository.notes as NoteRow[]).filter((note) => note.file !== null).length}</span></a></div>
</nav>
<div class="tabbed">
<section class="tab" id="${view('metrics-dora')}" aria-label="Metrics: DORA">
${group('The four keys, approximated to the release tag', 'Deployments are not observed; a release tag stands in for one on every card.', 4, doraPanels(signals, links))}
</section>
<section class="tab" id="${view('metrics-throughput')}" aria-label="Metrics: throughput">
${group(
  'How much ships, and how big?',
  'Throughput and batch size over the measured window, and what kind of work it was.',
  4,
  [
    panel(
      'Merge frequency',
      `${figure(String(signals.mergeFrequency.perDay ?? 'n/a'), `merges per day over ${signals.mergeFrequency.days ?? 'n/a'} days, ${count(signals.mergeFrequency.changes, 'change')}`)}${mergeActivity(changes)}`,
      trustBadges(signals.mergeFrequency.trust),
    ),
    panel(
      'Velocity',
      `${figure(
        signals.velocity.complexityPerWeek === null
          ? 'n/a'
          : String(signals.velocity.complexityPerWeek),
        `complexity per week over ${count(signals.velocity.weeks, 'week')}: ${signals.velocity.tasksPerWeek ?? 'n/a'} tasks, ${signals.velocity.changesPerWeek ?? 'n/a'} changes${signals.velocity.pointsPerWeek ? `, ${signals.velocity.pointsPerWeek} story points` : ''}`,
      )}${velocityChart(signals.trends.weekly)}<p class="help">${escapeHtml(signals.velocity.note)}${signals.velocity.unweightedTasks > 0 ? ` ${signals.velocity.unweightedTasks} of ${signals.velocity.tasks} completed tasks declared no weight and count one each.` : ''}${signals.velocity.excludedWithoutPoints > 0 && signals.velocity.storyPoints > 0 ? ` ${signals.velocity.excludedWithoutPoints} of ${signals.velocity.changes} changes recorded no points and are excluded from the points figure.` : ''}</p>`,
      `${trustBadges(signals.velocity.trust)} per repository and per week, never keyed to a person`,
    ),
    panel(
      'Batch size',
      `${figure(String(signals.batchSize.medianLines ?? 'n/a'), `median lines changed; ${signals.batchSize.medianFiles ?? 'n/a'} files and ${signals.batchSize.medianCommits ?? 'n/a'} commits per change`)}${diffChart(recentDiffs, 'lines added and removed per recent change')}<p class="help"><span class="added">added</span> above the line, <span class="removed">removed</span> below it: ${escapeHtml(`one column per change, oldest first, over the newest ${recentDiffs.length}; largest ${Math.max(0, ...recentDiffs.map((change) => Math.max(change.insertions, change.deletions))).toLocaleString('en-US')} lines.`)}</p>${cites('changes', signals.batchSize.cites, links)}`,
      `${trustBadges(['observed'])} over ${count(signals.batchSize.count, 'change')}`,
    ),
    workMixPanel(signals, links),
  ],
)}
</section>
<section class="tab" id="${view('economics-spend')}" aria-label="Economics: spend">
${group(
  'What the work cost',
  "Agents in the plan's currency, humans in hours, never summed.",
  3,
  [
    spendOverTime(signals.trends),
    allocationPanel(signals.allocation, links),
    spendTotal,
  ],
)}
${group(
  'Where it went',
  'By cost class, spec, provider, and model; reported cost beside the allocated share.',
  2,
  [
    costClassPanel(signals.costClasses, signals.coverage, links),
    meteredRatePanel(signals.meteredRates, links),
    spendTable(
      'Spend by spec',
      signals.spend.bySpec,
      excluded.missingFigures,
      links,
      signals.allocation,
      (aggregates) => aggregates.bySpec,
    ),
    spendTable(
      'Spend by provider',
      signals.spend.byProvider,
      excluded.missingFigures,
      links,
      signals.allocation,
      (aggregates) => aggregates.byProvider,
    ),
    spendTable(
      'Spend by model',
      signals.spend.byModel,
      excluded.missingFigures,
      links,
      signals.allocation,
      (aggregates) => aggregates.byModel,
    ),
  ],
)}
</section>
<section class="tab" id="${view('economics-effort')}" aria-label="Economics: effort">
${group(
  'Who did the work, and what did a unit cost?',
  'Agents carry currency and tokens, humans carry hours; there is no total across them because no record holds a rate.',
  2,
  [
    operatorPanel(signals.operators, links),
    hoursPanel(signals.hours, links),
    panel(
      'Cost per unit of effort',
      effortRows
        ? `<div class="scroll"><table><thead><tr><th>unit</th><th class="num">allocated per unit</th><th class="num">reported per unit</th><th class="num">changes</th><th class="num">excluded</th><th>cites</th></tr></thead><tbody>${effortRows}</tbody></table></div>`
        : '<p class="empty">No effort units enabled.</p>',
      `${trustBadges(['allocated', 'reported'])} allocated is the subscription share per unit, reported is metered cost per unit; tasks and their complexity come from each change's task list; excluded changes lack the unit or a complete session record`,
    ),
    unmergedSpend,
  ],
)}
</section>
<section class="tab" id="${view('records-changes')}" aria-label="Records: changes">
${group(
  'Recent changes',
  'The newest changes on the default branch, each with what it cost and who worked it.',
  1,
  [changesTable(changes, signals.spend.byChange, links, signals.allocation)],
)}
</section>
<section class="tab" id="${view('records-queue')}" aria-label="Records: queue">
${group(
  'What is waiting, and what is counted',
  'Open or closed is not observable from git; age is measured from the oldest commit not on the default branch.',
  3,
  [
    panel(
      'Unmerged queue',
      `${figure(String(signals.queue.count), `pull requests, oldest ${escapeHtml(seconds(signals.queue.oldestAgeSeconds))}`)}${queueChart}${
        queueRows
          ? `<div class="scroll tall"><table><thead><tr><th>pull request</th><th class="num">age</th><th class="num">commits</th><th class="num">spend</th><th class="num">man hours</th><th class="num">sessions</th><th>oldest commit</th><th>records</th></tr></thead><tbody>${queueRows}</tbody></table></div>`
          : '<p class="empty">Nothing waiting.</p>'
      }`,
      `${trustBadges([...signals.queue.trust, 'reported'])} ${escapeHtml(signals.queue.note)}; spend is what the pull request's own session records report. ${escapeHtml(signals.abandonment.count === 0 ? `none older than ${seconds(signals.abandonment.afterSeconds)}` : `${signals.abandonment.count} older than ${seconds(signals.abandonment.afterSeconds)}, carrying ${signals.abandonment.tokens.toLocaleString('en-US')} tokens${signals.abandonment.withoutFigures ? ` and ${signals.abandonment.withoutFigures} records without figures` : ''}`)}`,
      'span-2',
    ),
    panel(
      'Population',
      `${figure(String(outOfBand.length), `out-of-band changes of ${changes.length}; ${signals.boundary.preInstrumentation} before ${escapeHtml(signals.boundary.measuredFrom ? dateOnly(signals.boundary.measuredFrom) : 'measurement')} excluded${signals.boundary.declaredClosed.length ? `; declared closed: ${signals.boundary.declaredClosed.map((n) => `#${n}`).join(', ')}` : ''}; ${repository.unreleased.length} unreleased${repository.movedTags.length ? `; moved tags: ${escapeHtml((repository.movedTags as { tag: string }[]).map((entry) => entry.tag).join(', '))}` : ''}`)}${cites(
        'out-of-band',
        outOfBand.map((change) => change.id),
        links,
      )}`,
      trustBadges(['observed']),
    ),
    panel(
      'Local checks',
      figure(
        checks || 'none',
        checks
          ? 'session records with a check outcome'
          : 'no session recorded a check outcome yet',
      ),
      `${trustBadges(['reported'])} from session records`,
    ),
  ],
)}
</section>
<section class="tab" id="${view('records-notes')}" aria-label="Records: notes">
${group(
  'Operator notes',
  "An operator's dated explanation of a figure. A note explains a number and never changes one.",
  1,
  [
    notes ||
      panel(
        'Notes',
        '<p class="empty">No note recorded yet. Write one with <code>telemetry note add</code>; it is committed with the work and shown here beside the figure it explains.</p>',
        trustBadges(['reported']),
      ),
  ],
)}
</section>
<section class="tab tab--default" id="${view('metrics-flow')}" aria-label="Metrics: flow">
${signalPanels ? group('Thresholds exceeded', 'A registry threshold the repository crossed, with the changes behind it.', 3, [signalPanels]) : ''}
${group(
  'Where does work wait?',
  'From the pull head ref: how long finished work sat, how long a change took end to end, how much of that was someone working, and how long a spec took from first commit to archive.',
  4,
  [
    distributionPanel(
      'Wait time',
      signals.waitTime,
      'From the last commit on the pull request to the merge: how long finished work sat.',
      links,
    ),
    distributionPanel(
      'Cycle time',
      signals.cycleTime,
      'From the first commit on the pull request to the merge.',
      links,
    ),
    reads.efficiency,
    reads.specLeadTime,
  ],
)}
${group(
  'Is the work holding?',
  'Rework, escapes, whether changes were checked before they merged, and how many passes each took.',
  4,
  [
    panel(
      'Rework',
      `${figure(String(signals.rework.pairs.length), `pairs of changes touching the same file within ${signals.rework.windowDays} days`)}${topFiles(signals.rework.pairs)}${cites(
        'pairs',
        signals.rework.pairs.map((pair) => `${pair.later}<-${pair.earlier}`),
        links,
      )}`,
      `${trustBadges(['observed'])} most-touched files first`,
    ),
    panel(
      'Escapes',
      `${figure(signals.escapes.changes.length === 0 ? 'none' : String(signals.escapes.changes.length), `reverts or fixes after ${escapeHtml(signals.escapes.release ?? 'no release')} touching released files`)}${cites(
        'changes',
        signals.escapes.changes.map((entry) => entry.change),
        links,
      )}`,
      trustBadges(['observed']),
    ),
    reads.compliance,
    reads.iterations,
  ],
)}
</section>
</div>
</section>`;
}

/**
 * The nav cannot know which view is showing without a script, so the rules that mark it are generated per
 * repository: `:has` lets the page react to the section the URL names. A view is on when any of its
 * sub-views is targeted, and its row of sub-links shows under the same condition; Metrics › Flow is on when
 * nothing is targeted. A browser without `:has` shows every sub-row and no active mark, which costs a cue and
 * breaks nothing: every link still opens its view.
 */
const VIEWS: Record<string, string[]> = {
  metrics: ['metrics-flow', 'metrics-dora', 'metrics-throughput'],
  economics: ['economics-spend', 'economics-effort'],
  records: ['records-changes', 'records-queue', 'records-notes'],
};

function tabNavRules(labels: string[]): string {
  const on = 'color: var(--ink); border-bottom-color: var(--ink);';
  const subOn =
    'background: var(--panel); color: var(--ink); border-color: var(--line);';
  return labels
    .flatMap((label) =>
      Object.entries(VIEWS).flatMap(([parent, children]) => {
        const ids = children.map((name) => `${label}-${name}`);
        const any = `body:has(${ids.map((id) => `#${id}:target`).join(', ')})`;
        const none =
          parent === 'metrics' ? `, body:not(:has(.tab:target))` : '';
        const first = ids[0];
        return [
          `${any} nav.tabs a.top[href="#${first}"]${none ? `${none} nav.tabs a.top[href="#${first}"]` : ''} { ${on} }`,
          `${any} nav.tabs .row.sub-${parent}${none ? `${none} nav.tabs .row.sub-${parent}` : ''} { display: flex; }`,
          ...ids.map(
            (id, index) =>
              `body:has(#${id}:target) nav.tabs a.sub[href="#${id}"]${index === 0 && none ? `${none} nav.tabs a.sub[href="#${id}"]` : ''} { ${subOn} }`,
          ),
        ];
      }),
    )
    .join('\n');
}

const STYLE = `
:root {
  color-scheme: light dark;
  --bg: #f5f6f7; --panel: #ffffff; --ink: #14171c; --ink-2: #3d4652; --muted: #6b7480;
  --line: #e3e6ea; --line-strong: #ccd2d9;
  --accent: #23485f; --accent-soft: #dde8ef; --bar: #35607a; --bar-soft: #b9cfdd;
  --observed: #2c6b9a; --reported: #9a6414; --allocated: #6a4a9c; --signal: #b23b3b;
  --added: #2f7d4f; --removed: #a2453f; --gap: #fdf0df; --gap-ink: #7a4a10;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 36px;
  --radius: 10px;
  --gutter: clamp(16px, 4vw, 40px);
  --figure: clamp(23px, 0.9vw + 20px, 28px);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121416; --panel: #191c1f; --ink: #e9ebee; --ink-2: #c3c9d1; --muted: #8e97a3;
    --line: #262a2f; --line-strong: #363c44;
    --accent: #8fbbd9; --accent-soft: #1f3040; --bar: #7fb0d1; --bar-soft: #2d4556;
    --observed: #7fb3d9; --reported: #d9b37f; --allocated: #b89ad9; --signal: #e58a8a;
    --added: #7fc79b; --removed: #e08d87; --gap: #3a2a12; --gap-ink: #e8c48a;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0 0 var(--s6); background: var(--bg); color: var(--ink);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.wrap { max-width: 1240px; margin: 0 auto; padding-inline: var(--gutter); }
code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
a:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }

/* Top bar: the page, the repositories it holds, and the trust legend every figure refers to. */
header.band { background: var(--panel); border-bottom: 1px solid var(--line); }
header.band .wrap {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s4); flex-wrap: wrap;
  padding-block: var(--s3);
}
.brand { display: flex; align-items: baseline; gap: var(--s4); flex-wrap: wrap; }
h1 { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
h1 .dot { color: var(--accent); }
.nav { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s2); }
.nav a {
  color: var(--ink-2); background: var(--bg); border: 1px solid var(--line);
  border-radius: 999px; padding: 2px 10px; font-size: 12px;
}
.nav a:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
.legend { display: flex; gap: var(--s4); font-size: 11px; color: var(--muted); flex-wrap: wrap; }
.legend .badge { border: 0; padding: 0; font-size: 11px; }
.warn { color: var(--signal); font-weight: 500; }
.dim, .meta, .help, .asof, .empty, .cites-empty { color: var(--muted); font-size: 12px; }
.asof, .help, .empty, .meta { text-wrap: pretty; }
.meta, .help, .cites-empty { margin: 0; }

/* Trust classes: a dot and a word, the same three colors everywhere. */
.badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); white-space: nowrap; }
.badge::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: currentColor; flex: none; }
.badge-observed::before { background: var(--observed); }
.badge-reported::before { background: var(--reported); }
.badge-allocated::before { background: var(--allocated); }

/* Repository heading and headline. */
h2.repo {
  position: sticky; top: 0; z-index: 3; background: var(--bg);
  font-size: 19px; letter-spacing: -0.015em; margin: var(--s6) 0 var(--s1);
  border-top: 1px solid var(--line); padding-block: var(--s4) var(--s2);
  display: flex; align-items: baseline; gap: var(--s2); flex-wrap: wrap;
}
main > .repository:first-child h2.repo { margin-top: var(--s5); border-top: 0; padding-top: 0; }
.branch {
  font-size: 11px; font-weight: 500; color: var(--muted); border: 1px solid var(--line-strong);
  border-radius: 999px; padding: 1px 9px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
a.home { font-size: 12px; font-weight: 400; }
.asof { margin: 0 0 var(--s3); max-width: 70ch; }
.lede { margin: 0 0 var(--s4); font-size: 14px; color: var(--muted); max-width: 72ch; text-wrap: pretty; }
.lede a { color: var(--ink); border-bottom: 1px solid var(--line-strong); }
.lede a:hover { text-decoration: none; border-bottom-color: var(--accent); }
.kpis {
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden;
  box-shadow: 0 1px 2px rgba(16, 20, 24, 0.05), 0 10px 24px -16px rgba(16, 20, 24, 0.24);
}
.kpi {
  padding: var(--s4) 18px 14px; border-right: 1px solid var(--line); min-width: 0;
  display: flex; flex-direction: column; gap: 6px; color: inherit;
}
.kpi:hover { background: var(--bg); text-decoration: none; }
.kpi:last-child { border-right: 0; }
.kpi-label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted);
  display: flex; justify-content: space-between; gap: var(--s2); flex-wrap: wrap;
}
.kpi-label .badge { text-transform: none; letter-spacing: 0; }
.kpi-value {
  font-size: clamp(24px, 1.2vw + 18px, 32px); font-weight: 650; letter-spacing: -0.03em; line-height: 1.1;
  font-variant-numeric: tabular-nums; overflow-wrap: anywhere;
}
.kpi-value small { display: block; font-size: 12px; font-weight: 500; color: var(--muted); letter-spacing: 0; }
.kpi-sub { font-size: 12px; color: var(--muted); }
.spark { display: block; width: 100%; height: 28px; }
@media (max-width: 900px) {
  .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .kpi { border-bottom: 1px solid var(--line); }
  .kpi:nth-child(3n) { border-right: 0; }
}
@media (max-width: 560px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kpi:nth-child(3n) { border-right: 1px solid var(--line); }
  .kpi:nth-child(2n) { border-right: 0; }
}

/* Two levels of views, each a fragment on this page and selected by CSS: a view is a URL, so a link to
   one opens it, which is what keeps a figure citable. The default view is last in the document so the
   sibling selector can hide it once any other is targeted, and order puts it back first on screen. */
nav.tabs {
  position: sticky; top: 0; z-index: 4; background: var(--bg);
  border-bottom: 1px solid var(--line); margin-top: var(--s3);
  display: flex; flex-direction: column;
}
nav.tabs .row { display: flex; gap: var(--s1); overflow-x: auto; scrollbar-width: none; }
nav.tabs a.top {
  padding: 11px 12px 9px; color: var(--muted); font-weight: 600; font-size: 13px; white-space: nowrap;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
nav.tabs a.top:hover { color: var(--ink); text-decoration: none; }
nav.tabs .row.sub { display: none; border-top: 1px solid var(--line); padding: 6px 0; }
nav.tabs a.sub {
  font-size: 12px; color: var(--muted); padding: 3px 10px; border-radius: 999px; white-space: nowrap;
  border: 1px solid transparent;
}
nav.tabs a.sub:hover { color: var(--ink); text-decoration: none; }
nav.tabs a.sub .n { color: var(--muted); font-weight: 400; margin-left: 4px; font-variant-numeric: tabular-nums; }
.tabbed { display: flex; flex-direction: column; }
.tabbed > .tab { display: none; }
.tabbed > .tab:target { display: block; }
.tabbed > .tab--default { display: block; order: -1; }
.tabbed > .tab:target ~ .tab--default { display: none; }
@supports not selector(:has(a)) {
  nav.tabs .row.sub { display: flex; }
}

/* Groups: each answers one question; the column count says how its panels relate. */
.group { padding-block: var(--s5) var(--s2); }
.group-head { display: flex; align-items: baseline; gap: var(--s3); flex-wrap: wrap; margin-bottom: var(--s3); }
h2.question { font-size: 16px; font-weight: 650; letter-spacing: -0.015em; margin: 0; }
.group-head p { margin: 0; font-size: 13px; color: var(--muted); text-wrap: pretty; }
.grid {
  display: grid; gap: 1px; background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--radius); overflow: hidden; align-items: stretch;
}
.grid.c1 { grid-template-columns: 1fr; }
.grid.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid.c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid.c4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid.wide { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: var(--s3); }
.panel.span-all { grid-column: 1 / -1; }
.panel.span-2 { grid-column: span 2; }
@media (max-width: 900px) {
  .grid.c3, .grid.c4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .grid.c2, .grid.c3, .grid.c4, .grid.wide { grid-template-columns: 1fr; }
  .panel.span-2 { grid-column: auto; }
  h2.repo { position: static; }
}

/* Panel: title and trust, figure, chart or table, then the fold, then citations. */
.panel {
  background: var(--panel); padding: var(--s4) 18px 14px; min-width: 0;
  display: flex; flex-direction: column; gap: var(--s2); container-type: inline-size;
  box-shadow: 0 0 0 1px var(--line);
}
.panel .head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--s2); flex-wrap: wrap; }
h3 { font-size: 12px; font-weight: 600; margin: 0; color: var(--ink-2); letter-spacing: 0.01em; }
.trust { display: flex; gap: var(--s2); flex-wrap: wrap; }
.panel.signal { box-shadow: inset 3px 0 0 var(--signal), 0 0 0 1px var(--line); }
.figure {
  font-size: var(--figure); margin: 2px 0 0; font-weight: 650; letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums; line-height: 1.1;
}
.figure .unit {
  display: block; font-size: 12px; color: var(--muted); font-weight: 400; letter-spacing: 0;
  margin-top: var(--s1); line-height: 1.45; text-wrap: pretty;
}
@container (max-width: 330px) {
  .meter { display: none; }
  .figure { font-size: 22px; }
}
.foot { display: flex; gap: var(--s4); flex-wrap: wrap; margin-top: auto; padding-top: var(--s1); }
details { font-size: 12px; color: var(--muted); }
details summary { cursor: pointer; list-style: none; display: inline-flex; align-items: center; gap: 6px; }
details summary::-webkit-details-marker { display: none; }
details summary::before { content: "\\25B8"; font-size: 10px; }
details[open] summary::before { content: "\\25BE"; }
details summary:hover { color: var(--ink); }
details.how { max-width: 100%; }
details.how p { margin: 6px 0 0; color: var(--ink-2); max-width: 64ch; }
details.how p + p { margin-top: var(--s1); }
details.cites ul {
  margin: var(--s2) 0 0; padding-left: var(--s4); max-height: 200px; overflow: auto;
  scrollbar-width: thin; overscroll-behavior: contain;
  content-visibility: auto; contain-intrinsic-size: auto 200px;
}
details.cites li { margin-bottom: 3px; text-wrap: pretty; }
details.more .more-body { margin: 4px 0 0; white-space: normal; color: var(--ink-2); }
.cite-title { color: var(--ink); }
.cite-join { color: var(--muted); padding: 0 6px; }
.alloc { color: var(--allocated); font-size: 12px; white-space: nowrap; }
.gap {
  display: inline-block; padding: 0 6px; border-radius: 4px; font-size: 11px;
  background: var(--gap); color: var(--gap-ink);
}
.added { color: var(--added); }
.removed { color: var(--removed); }

/* Charts. */
.chart { display: block; overflow: visible; }
.bar { fill: var(--bar); }
.bar-soft { fill: var(--bar-soft); }
.bar-alt { fill: var(--removed); }
line.gridline { stroke: var(--line); stroke-width: 1; }
line.axis { stroke: var(--line-strong); stroke-width: 1; }
text.tick { font-size: 10px; fill: var(--muted); }
text.value { font-size: 11px; fill: var(--ink); font-weight: 500; }
.meter {
  display: inline-block; width: 44px; height: 5px; border-radius: 999px; background: var(--accent-soft);
  margin-right: var(--s2); vertical-align: middle; overflow: hidden; flex: none;
}
.meter-fill { display: block; height: 100%; background: var(--bar); border-radius: 999px; }
ul.list { margin: 0; padding-left: var(--s4); font-size: 12px; }
ul.list.ranked { list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: var(--s1); }
ul.list.ranked li { display: flex; align-items: center; min-width: 0; }
ul.list.ranked code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
ul.list.ranked .dim { white-space: nowrap; padding-left: var(--s1); }

/* Tables. */
.scroll { overflow: auto; scrollbar-width: thin; overscroll-behavior: contain; }
.scroll.tall { max-height: min(460px, 70vh); }
table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
thead th {
  position: sticky; top: 0; z-index: 1; background: var(--panel);
  text-align: left; font-weight: 600; color: var(--muted); text-transform: uppercase;
  letter-spacing: 0.06em; font-size: 10.5px; box-shadow: inset 0 -1px 0 var(--line-strong);
}
th, td { padding: 7px var(--s2) 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; white-space: nowrap; }
thead th { border-bottom: 0; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover td { background: var(--bg); }
td.subject { white-space: normal; min-width: 240px; text-wrap: pretty; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.nowrap { white-space: nowrap; }
td.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
a.ref { color: var(--accent); border-bottom: 1px solid var(--accent-soft); }
a.ref:hover { text-decoration: none; border-bottom-color: var(--accent); }
.repository { content-visibility: auto; contain-intrinsic-size: auto 1400px; }
footer {
  margin-top: var(--s6); padding-top: var(--s4); border-top: 1px solid var(--line);
  color: var(--muted); font-size: 12px; max-width: 78ch; text-wrap: pretty;
}
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
  a.ref, .nav a, details summary { transition: color 120ms ease, border-color 120ms ease; }
}
@media print {
  body { background: #fff; padding: 0; }
  h2.repo, nav.tabs { position: static; }
  .kpis { box-shadow: none; }
  .panel { break-inside: avoid; }
  .repository { content-visibility: visible; }
  .scroll, .scroll.tall, details.cites ul { max-height: none; overflow: visible; }
  details > *:not(summary) { display: block; }
}
`;

export function renderLedgerHtml(projection: Projection | null): string {
  const repositories = projection ? Object.values(projection.repositories) : [];
  const unreachable = repositories.filter(
    (repository) => !repository.reachable,
  );
  const body =
    repositories.length === 0
      ? `<p class="empty">The Ledger is empty. Register a repository in <code>registry.json</code>, then run <code>telemetry sync</code> and <code>telemetry rebuild</code>.</p>`
      : `${registrySection(projection)}${repositories.map(renderRepositoryHtml).join('\n')}`;
  const nav = repositories
    .map(
      (repository) =>
        `<a href="#${escapeHtml(repository.name)}">${escapeHtml(repository.name)}</a>`,
    )
    .join('');
  const versions = projection
    ? `Projection schema ${projection.schemaVersion}, session schema ${projection.sessionSchemaVersion}, registry schema ${projection.registrySchemaVersion}.`
    : 'No projection.';
  const registered = `${count(repositories.length, 'repository', 'repositories')} registered${unreachable.length ? `, ${unreachable.length} unreachable (${escapeHtml(unreachable.map((repository) => repository.name).join(', '))})` : ''}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Ledger</title>
<style>${STYLE}\n${tabNavRules(repositories.filter((repository) => repository.reachable).map((repository) => `${escapeHtml(repository.name)}-heading`))}</style>
</head>
<body>
<header class="band"><div class="wrap">
<div class="brand"><h1>The Ledger<span class="dot">.</span></h1>${nav ? `<nav class="nav" aria-label="Repositories">${nav}</nav>` : ''}</div>
<div class="legend" aria-label="Trust classes"><span class="badge badge-observed">observed from git</span><span class="badge badge-reported">reported by a harness or operator</span><span class="badge badge-allocated">allocated from a plan</span></div>
</div></header>
<main class="wrap">
${body}
<footer>Every figure names the trust classes it was computed from and the changes or records behind it. Nothing here is resolved to a person: operators are a pseudonymous identifier or a provider and model. Reviews, checks, and platform timestamps are not observed; see docs/methodology.md. ${escapeHtml(versions)} ${registered}.</footer>
</main>
</body>
</html>
`;
}
