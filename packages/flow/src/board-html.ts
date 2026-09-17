import type { Projection, RepositoryProjection } from './projection.ts';
import type { Distribution, Spend } from './signals.ts';

// The Board as one self-contained HTML page: inline styles, inline SVG, no script, no loaded resource.
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

function count(
  value: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

// --- Citations -------------------------------------------------------------------------------------

const HASH = /^[0-9a-f]{40}$/;

/** What the page needs to turn a cite string into a titled, linked citation. */
type Links = {
  web: string | null;
  branch: string;
  subjects: Map<string, string>;
};

function linksFor(repository: RepositoryProjection): Links {
  const subjects = new Map<string, string>();
  for (const change of repository.changes as {
    id: string;
    subject: string;
  }[]) {
    subjects.set(change.id, change.subject);
  }
  return {
    web: repository.webUrl,
    branch: repository.defaultBranch,
    subjects,
  };
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

function cites(label: string, ids: string[], links: Links): string {
  if (ids.length === 0) {
    return `<p class="cites-empty">cites: none</p>`;
  }
  const items = ids.map((id) => `<li>${cite(id, links)}</li>`).join('');
  return `<details class="cites"><summary>${escapeHtml(label)}: ${ids.length}</summary><ul>${items}</ul></details>`;
}

// --- Chrome ----------------------------------------------------------------------------------------

function trustBadges(trust: string[]): string {
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

function panel(
  title: string,
  body: string,
  meta = '',
  extraClass = '',
): string {
  return `<section class="panel${extraClass ? ' ' + extraClass : ''}"><h3>${escapeHtml(title)}</h3>${meta ? `<p class="meta">${meta}</p>` : ''}${body}</section>`;
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
): string {
  return `<tr><td>${escapeHtml(label)}</td><td class="num">${meter(spend.costUsd, largest)}$${spend.costUsd.toFixed(2)}</td><td class="num">${(spend.inputTokens + spend.outputTokens).toLocaleString('en-US')}</td><td class="num">${spend.cachedTokens.toLocaleString('en-US')}</td><td class="num">${spend.sessions}</td><td>${cites('records', spend.cites, links)}</td></tr>`;
}

function spendTable(
  title: string,
  rows: Record<string, Spend>,
  missingFigures: number,
  links: Links,
): string {
  const entries = Object.entries(rows);
  const key = title.replace('Spend by ', '');
  const meta = `${trustBadges(['reported'])} keyed to ${escapeHtml(key)}, never to a person`;
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
    .map(([label, spend]) => spendRow(label, spend, largest, links))
    .join('');
  return panel(
    title,
    `<div class="scroll"><table><thead><tr><th>${escapeHtml(key)}</th><th class="num">cost</th><th class="num">tokens</th><th class="num">cached</th><th class="num">sessions</th><th>cites</th></tr></thead><tbody>${body}</tbody></table></div>`,
    meta,
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

function changesTable(changes: ChangeRow[], links: Links): string {
  const recent = [...changes].reverse().slice(0, 15);
  const rows = recent
    .map((change) => {
      const sessions =
        change.sessions.status === 'declared'
          ? change.sessions.sessions.length
            ? escapeHtml(change.sessions.sessions.join(', '))
            : `<span class="warn">unreported</span>`
          : `<span class="${change.sessions.status === 'undeclared' ? 'warn' : 'dim'}">${escapeHtml(change.sessions.status)}</span>`;
      const gaps = change.gaps
        .map((gap) => `<span class="gap">${escapeHtml(gap.type)}</span>`)
        .join(' ');
      return `<tr><td class="mono">${escapeHtml(dateOnly(change.mergeTime))}</td><td class="subject">${href(links, `commit/${change.id}`, change.id.slice(0, 10))} <span class="cite-title">${escapeHtml(change.subject)}</span></td><td>${pullRef(change.association.pullRequest, links)} <span class="dim">${escapeHtml(change.association.method ?? '')}</span></td><td class="num">${escapeHtml(seconds(change.timing.waitTimeSeconds))}</td><td class="num">${escapeHtml(seconds(change.timing.cycleTimeSeconds))}</td><td class="num nowrap"><span class="added">+${change.insertions}</span> <span class="removed">−${change.deletions}</span></td><td>${sessions}</td><td>${gaps || '<span class="dim">none</span>'}</td></tr>`;
    })
    .join('');
  return panel(
    'Recent changes',
    `<div class="scroll tall"><table class="changes"><thead><tr><th>merged</th><th>change</th><th>pull request</th><th class="num">wait</th><th class="num">cycle</th><th class="num">lines</th><th>sessions</th><th>gaps</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    `${trustBadges(['observed'])} the newest ${recent.length} of ${changes.length} changes on the default branch; wait and cycle come from the pull head ref, sessions from the harness`,
    'span-all',
  );
}

/** One column per day between the first and last merge, or per week when that is more than 60 columns. */
function mergeActivity(changes: ChangeRow[]): string {
  const days = changes
    .map((change) => dateOnly(change.mergeTime))
    .filter((day) => day !== 'unknown')
    .sort();
  if (days.length === 0) {
    return '';
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
  const period = perBucket === 1 ? 'day' : 'week';
  const peak = Math.max(...buckets.map((bucket) => bucket.value));
  return `${columnChart(buckets, 'changes merged over the measured window')}<p class="help">${escapeHtml(
    `One column per ${period} from ${days[0]} to ${days[days.length - 1]}; busiest ${period}, ${count(peak, 'change')}.`,
  )}</p>`;
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

export function renderRepositoryHtml(repository: RepositoryProjection): string {
  const links = linksFor(repository);
  const home =
    repository.webUrl === null
      ? ''
      : ` <a class="ref home" href="${escapeHtml(repository.webUrl)}">${escapeHtml(repository.webUrl.replace(/^https:\/\//, ''))}</a>`;
  const label = `${escapeHtml(repository.name)}-heading`;
  const heading = `<h2 id="${escapeHtml(repository.name)}"><span id="${label}">${escapeHtml(repository.name)}</span> <span class="branch">${escapeHtml(repository.defaultBranch)}</span>${home}</h2>`;
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
  const summary = [
    ['typical wait', seconds(signals.waitTime.p50), 'observed'],
    ['typical cycle', seconds(signals.cycleTime.p50), 'observed'],
    ['queue', `${signals.queue.count}`, 'observed'],
    ['merges / day', `${signals.mergeFrequency.perDay ?? 'n/a'}`, 'observed'],
    ['spend', `$${signals.spend.total.costUsd.toFixed(2)}`, 'reported'],
    ['out-of-band', `${outOfBand.length}`, 'observed'],
  ]
    .map(
      ([label, value, trust]) =>
        `<div class="stat"><dt class="stat-label">${escapeHtml(label)} ${trustBadges([trust])}</dt><dd class="stat-value">${escapeHtml(value)}</dd></div>`,
    )
    .join('');
  const signalPanels = signals.signals
    .map(
      (signal) =>
        `<section class="panel signal"><h3>Signal: ${escapeHtml(signal.signal)}</h3><p class="meta">observed ${escapeHtml(seconds(signal.observed))} over the registry threshold of ${escapeHtml(seconds(signal.threshold))}</p>${cites('changes', signal.cites, links)}</section>`,
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
    .map(
      (entry) =>
        `<tr><td>${pullRef(entry.number, links)}</td><td class="num">${escapeHtml(seconds(entry.age))}</td><td class="num">${entry.commits}</td><td class="mono">${escapeHtml(dateOnly(entry.oldestCommitAt))}</td></tr>`,
    )
    .join('');
  const excludedLine = `${excluded.undeclared} undeclared, ${excluded.unreported} unreported, ${excluded.humanOnly} human-only, ${excluded.invalidSession} invalid, ${excluded.missingFigures} with figures missing`;
  const effortRows = Object.values(signals.spend.perEffortUnit)
    .map(
      (unit) =>
        `<tr><td>${escapeHtml(unit.unit)}</td><td class="num">${unit.costPerUnit === null ? 'n/a' : '$' + unit.costPerUnit.toFixed(4)}</td><td class="num">${unit.changes}</td><td class="num">${unit.excluded}</td><td>${cites('changes', unit.cites, links)}</td></tr>`,
    )
    .join('');
  const checks = Object.entries(signals.localChecks)
    .map(([outcome, value]) => `${value} ${escapeHtml(outcome)}`)
    .join(', ');
  const recentDiffs = [...changes].slice(-24);
  return `${open}${heading}
<p class="asof">Measured as of ${escapeHtml(dateOnly(repository.asOf))}, the newest commit the mirror holds. Merge times are the merging party's clock.</p>
<dl class="stats">${summary}</dl>
${signalPanels}
<div class="grid">
${panel(
  'Merge frequency',
  `${figure(String(signals.mergeFrequency.perDay ?? 'n/a'), `merges per day over ${signals.mergeFrequency.days ?? 'n/a'} days, ${count(signals.mergeFrequency.changes, 'change')}`)}${mergeActivity(changes)}`,
  trustBadges(signals.mergeFrequency.trust),
)}
${distributionPanel('Wait time', signals.waitTime, 'From the last commit on the pull request to the merge: how long finished work sat.', links)}
${distributionPanel('Cycle time', signals.cycleTime, 'From the first commit on the pull request to the merge.', links)}
${panel(
  'Batch size',
  `${figure(String(signals.batchSize.medianLines ?? 'n/a'), `median lines changed; ${signals.batchSize.medianFiles ?? 'n/a'} files and ${signals.batchSize.medianCommits ?? 'n/a'} commits per change`)}${diffChart(recentDiffs, 'lines added and removed per recent change')}<p class="help"><span class="added">added</span> above the line, <span class="removed">removed</span> below it: ${escapeHtml(`one column per change, oldest first, over the newest ${recentDiffs.length}; largest ${Math.max(0, ...recentDiffs.map((change) => Math.max(change.insertions, change.deletions))).toLocaleString('en-US')} lines.`)}</p>${cites('changes', signals.batchSize.cites, links)}`,
  `${trustBadges(['observed'])} over ${count(signals.batchSize.count, 'change')}`,
)}
${panel(
  'Unmerged queue',
  `${figure(String(signals.queue.count), `pull requests, oldest ${escapeHtml(seconds(signals.queue.oldestAgeSeconds))}`)}${queueChart}${
    queueRows
      ? `<div class="scroll tall"><table><thead><tr><th>pull request</th><th class="num">age</th><th class="num">commits</th><th>oldest commit</th></tr></thead><tbody>${queueRows}</tbody></table></div>`
      : '<p class="empty">Nothing waiting.</p>'
  }`,
  `${trustBadges(signals.queue.trust)} ${escapeHtml(signals.queue.note)}`,
)}
${panel(
  'Rework',
  `${figure(String(signals.rework.pairs.length), `pairs of changes touching the same file within ${signals.rework.windowDays} days`)}${topFiles(signals.rework.pairs)}${cites(
    'pairs',
    signals.rework.pairs.map((pair) => `${pair.later}<-${pair.earlier}`),
    links,
  )}`,
  `${trustBadges(['observed'])} most-touched files first`,
)}
${panel(
  'Escapes',
  `${figure(String(signals.escapes.changes.length), `reverts or fixes after ${escapeHtml(signals.escapes.release ?? 'no release')} touching released files`)}${cites(
    'changes',
    signals.escapes.changes.map((entry) => entry.change),
    links,
  )}`,
  trustBadges(['observed']),
)}
${panel('Local checks', figure(checks || 'none', checks ? 'session records with a check outcome' : 'no session recorded a check outcome yet'), `${trustBadges(['reported'])} from session records`)}
${panel(
  'Spend',
  `${figure(`$${signals.spend.total.costUsd.toFixed(2)}`, `${(signals.spend.total.inputTokens + signals.spend.total.outputTokens).toLocaleString('en-US')} tokens over ${signals.spend.total.sessions} sessions with figures`)}${cites('records', signals.spend.total.cites, links)}`,
  `${trustBadges(signals.spend.trust)} excluded: ${escapeHtml(excludedLine)} (counted, never zeroed)`,
)}
${panel(
  'Population',
  `${figure(String(outOfBand.length), `out-of-band changes of ${changes.length}; ${repository.unreleased.length} unreleased${repository.movedTags.length ? `; moved tags: ${escapeHtml((repository.movedTags as { tag: string }[]).map((entry) => entry.tag).join(', '))}` : ''}`)}${cites(
    'out-of-band',
    outOfBand.map((change) => change.id),
    links,
  )}`,
  trustBadges(['observed']),
)}
</div>
${changesTable(changes, links)}
<div class="grid wide">
${spendTable('Spend by spec', signals.spend.bySpec, excluded.missingFigures, links)}
${spendTable('Spend by provider', signals.spend.byProvider, excluded.missingFigures, links)}
${spendTable('Spend by model', signals.spend.byModel, excluded.missingFigures, links)}
${panel(
  'Cost per unit of effort',
  effortRows
    ? `<div class="scroll"><table><thead><tr><th>unit</th><th class="num">cost per unit</th><th class="num">changes</th><th class="num">excluded</th><th>cites</th></tr></thead><tbody>${effortRows}</tbody></table></div>`
    : '<p class="empty">No effort units enabled.</p>',
  `${trustBadges(['reported'])} excluded changes lack the unit or a complete session record`,
)}
${
  signals.spend.unmergedPullRequests.sessions > 0
    ? panel(
        'Spend on unmerged pull requests',
        `${figure(`$${signals.spend.unmergedPullRequests.costUsd.toFixed(2)}`, `over ${count(signals.spend.unmergedPullRequests.sessions, 'session')}`)}${cites('records', signals.spend.unmergedPullRequests.cites, links)}`,
        trustBadges(['reported']),
      )
    : ''
}
</div>
</section>`;
}

const STYLE = `
:root {
  color-scheme: light dark;
  --bg: #f4f5f3; --bg-accent: #e9ece7; --panel: #ffffff; --ink: #16181a; --muted: #5f6368;
  --line: #e0e2dd; --line-strong: #cbcec8; --accent: #2f6f9f; --accent-soft: #d8e6f1;
  --observed: #2f6f9f; --reported: #92611d; --signal: #b23a3a; --added: #2f7d4f; --removed: #a2453f;
  --gap: #fdf0df; --gap-ink: #7a4a10;
  --shadow: 0 1px 2px rgba(16, 20, 24, 0.05), 0 10px 24px -16px rgba(16, 20, 24, 0.24);
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 36px;
  --radius: 12px;
  --gutter: clamp(16px, 4vw, 34px);
  --title: clamp(22px, 1.1vw + 19px, 28px);
  --figure: clamp(23px, 0.9vw + 20px, 28px);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111312; --bg-accent: #1a1d1b; --panel: #1d201e; --ink: #ecece7; --muted: #a2a49d;
    --line: #2e322f; --line-strong: #3d423e; --accent: #7fb3d9; --accent-soft: #24384b;
    --observed: #7fb3d9; --reported: #d9b37f; --signal: #e58a8a; --added: #7fc79b; --removed: #e08d87;
    --gap: #3a2a12; --gap-ink: #e8c48a; --shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0 0 var(--s6); background: var(--bg); color: var(--ink);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.wrap { max-width: 1320px; margin: 0 auto; padding-inline: var(--gutter); }
header.band {
  background: var(--bg-accent); border-bottom: 1px solid var(--line);
  padding-block: var(--s5) var(--s4); margin-bottom: var(--s5);
}
h1 { font-size: var(--title); letter-spacing: -0.02em; margin: 0 0 var(--s1); text-wrap: balance; }
h1 .dot { color: var(--accent); }
h2 {
  position: sticky; top: 0; z-index: 3; background: var(--bg);
  font-size: 19px; letter-spacing: -0.015em; margin: var(--s6) 0 var(--s1);
  border-top: 1px solid var(--line); padding-block: var(--s4) var(--s2);
  display: flex; align-items: baseline; gap: var(--s2); flex-wrap: wrap;
}
main > .repository:first-child h2 { margin-top: 0; border-top: 0; padding-top: 0; }
h3 {
  font-size: 11px; margin: 0; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--muted); font-weight: 600;
}
.branch {
  font-size: 11px; font-weight: 500; color: var(--muted); border: 1px solid var(--line-strong);
  border-radius: 999px; padding: 1px 9px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.asof, .meta, .cites-empty, .empty, .help, .dim { color: var(--muted); font-size: 12px; }
.asof, .help, .empty { text-wrap: pretty; }
.asof { margin: 0 0 var(--s4); max-width: 68ch; }
.meta, .help, .cites-empty { margin: 0; }
.warn { color: var(--signal); font-weight: 500; }
.nav { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s2); margin-top: var(--s3); }
.nav a {
  color: var(--ink); text-decoration: none; background: var(--panel); border: 1px solid var(--line);
  border-radius: 999px; padding: 3px 12px; font-size: 12px;
}
.nav a:hover { border-color: var(--accent); color: var(--accent); }
.stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
  gap: var(--s2); margin: 0 0 var(--s4);
}
.stat {
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
  padding: var(--s3) var(--s4); box-shadow: var(--shadow); margin: 0;
  display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: var(--s1);
}
.stat-value {
  font-size: var(--figure); font-weight: 600; letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums; line-height: 1.15; margin: 0;
}
.stat-label {
  font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em;
  display: flex; align-items: center; gap: var(--s1); flex-wrap: wrap;
}
.grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(min(310px, 100%), 1fr));
  gap: var(--s3); margin-top: var(--s3); align-items: start;
}
.grid.wide { grid-template-columns: repeat(auto-fit, minmax(min(430px, 100%), 1fr)); }
@media (max-width: 720px) {
  .grid, .grid.wide { grid-template-columns: 1fr; }
  h2 { position: static; }
}
.panel {
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
  padding: var(--s4); min-width: 0; box-shadow: var(--shadow);
  display: flex; flex-direction: column; gap: var(--s2); container-type: inline-size;
}
.panel.signal { border-color: var(--signal); border-left-width: 3px; margin-top: var(--s3); }
.panel.span-all { margin-top: var(--s3); }
@container (max-width: 330px) {
  .meter { display: none; }
  .figure { font-size: 22px; }
}
.figure {
  font-size: var(--figure); margin: 0; font-weight: 600; letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums; line-height: 1.15;
}
.figure .unit {
  display: block; font-size: 12px; color: var(--muted); font-weight: 400; letter-spacing: 0;
  margin-top: var(--s1); line-height: 1.45; text-wrap: pretty;
}
.badge {
  display: inline-block; padding: 0 7px; border-radius: 999px; font-size: 10px; font-weight: 500;
  border: 1px solid currentColor; vertical-align: middle; text-transform: none; letter-spacing: 0;
  white-space: nowrap;
}
.badge-observed { color: var(--observed); }
.badge-reported { color: var(--reported); }
.gap {
  display: inline-block; padding: 0 6px; border-radius: 4px; font-size: 11px;
  background: var(--gap); color: var(--gap-ink);
}
.added { color: var(--added); }
.removed { color: var(--removed); }
.chart { display: block; overflow: visible; }
.bar { fill: var(--accent); }
.bar-alt { fill: var(--removed); }
line.gridline { stroke: var(--line); stroke-width: 1; }
line.axis { stroke: var(--line-strong); stroke-width: 1; }
text.tick { font-size: 10px; fill: var(--muted); }
text.value { font-size: 11px; fill: var(--ink); font-weight: 500; }
.meter {
  display: inline-block; width: 44px; height: 6px; border-radius: 999px; background: var(--accent-soft);
  margin-right: var(--s2); vertical-align: middle; overflow: hidden; flex: none;
}
.meter-fill { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.scroll { overflow: auto; scrollbar-width: thin; overscroll-behavior: contain; }
.scroll.tall { max-height: min(460px, 70vh); }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
thead th {
  position: sticky; top: 0; z-index: 1; background: var(--panel);
  text-align: left; font-weight: 600; color: var(--muted); text-transform: uppercase;
  letter-spacing: 0.06em; font-size: 10px; box-shadow: inset 0 -1px 0 var(--line-strong);
}
th, td { padding: 6px var(--s2) 6px 0; border-bottom: 1px solid var(--line); vertical-align: top; white-space: nowrap; }
thead th { border-bottom: 0; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover td { background: var(--bg-accent); }
td.subject { white-space: normal; min-width: 240px; text-wrap: pretty; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.nowrap { white-space: nowrap; }
td.mono, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
a.ref { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--accent-soft); }
a.ref:hover { border-bottom-color: var(--accent); }
a.home { font-size: 12px; font-weight: 400; }
a:focus-visible, summary:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px;
}
.cite-title { color: var(--ink); }
.cite-join { color: var(--muted); padding: 0 6px; }
details.cites summary { cursor: pointer; color: var(--muted); font-size: 12px; }
details.cites summary:hover { color: var(--accent); }
details.cites ul {
  margin: var(--s2) 0 0; padding-left: var(--s4); max-height: 200px; overflow: auto;
  font-size: 12px; scrollbar-width: thin; overscroll-behavior: contain;
  content-visibility: auto; contain-intrinsic-size: auto 200px;
}
details.cites li { margin-bottom: 3px; text-wrap: pretty; }
ul.list { margin: 0; padding-left: var(--s4); font-size: 12px; }
ul.list.ranked { list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: var(--s1); }
ul.list.ranked li { display: flex; align-items: center; min-width: 0; }
ul.list.ranked code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
ul.list.ranked .dim { white-space: nowrap; padding-left: var(--s1); }
.repository { content-visibility: auto; contain-intrinsic-size: auto 1400px; }
footer {
  margin-top: var(--s6); padding-top: var(--s4); border-top: 1px solid var(--line);
  color: var(--muted); font-size: 12px; max-width: 78ch; text-wrap: pretty;
}
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
  a.ref, .nav a, details.cites summary { transition: color 120ms ease, border-color 120ms ease; }
}
@media print {
  body { background: #fff; padding: 0; }
  h2 { position: static; }
  .panel, .stat { box-shadow: none; break-inside: avoid; }
  .repository { content-visibility: visible; }
  .scroll, .scroll.tall, details.cites ul { max-height: none; overflow: visible; }
  details.cites > ul { display: block; }
}
`;

export function renderBoardHtml(projection: Projection | null): string {
  const repositories = projection ? Object.values(projection.repositories) : [];
  const unreachable = repositories.filter(
    (repository) => !repository.reachable,
  );
  const body =
    repositories.length === 0
      ? `<p class="empty">The Board is empty. Register a repository in <code>registry.json</code>, then run <code>telemetry sync</code> and <code>telemetry rebuild</code>.</p>`
      : repositories.map(renderRepositoryHtml).join('\n');
  const nav = repositories
    .map(
      (repository) =>
        `<a href="#${escapeHtml(repository.name)}">${escapeHtml(repository.name)}</a>`,
    )
    .join('');
  const versions = projection
    ? `projection schema ${projection.schemaVersion}, session schema ${projection.sessionSchemaVersion}, registry schema ${projection.registrySchemaVersion}`
    : 'no projection';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Board</title>
<style>${STYLE}</style>
</head>
<body>
<header class="band"><div class="wrap">
<h1>The Board<span class="dot">.</span></h1>
<p class="meta">${escapeHtml(versions)} · ${count(repositories.length, 'repository', 'repositories')} registered, ${unreachable.length} unreachable${unreachable.length ? ' (' + escapeHtml(unreachable.map((repository) => repository.name).join(', ')) + ')' : ''}</p>
${nav ? `<nav class="nav">${nav}</nav>` : ''}
</div></header>
<main class="wrap">
${body}
<footer>Every figure names the trust classes it was computed from and the changes or records behind it. Nothing here is keyed to a person. Reviews, checks, and platform timestamps are not observed; see docs/methodology.md.</footer>
</main>
</body>
</html>
`;
}
