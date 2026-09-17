import type { Projection, RepositoryProjection } from './projection.ts';
import type { Distribution, Spend } from './signals.ts';

// The Board as one self-contained HTML page: inline styles, inline SVG, no script, no external resource.
// Same figures as the terminal render, laid out per repository, with trust classes and excluded counts
// beside every figure and its citations expandable beneath it.

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
  if (value < 3600) {
    return `${Math.round(value / 60)} min`;
  }
  if (value < 86_400) {
    return `${(value / 3600).toFixed(1)} h`;
  }
  return `${(value / 86_400).toFixed(1)} d`;
}

function short(id: string): string {
  return id
    .split('<-')
    .map((part) => (/^[0-9a-f]{40}$/.test(part) ? part.slice(0, 10) : part))
    .join(' ← ');
}

function trustBadges(trust: string[]): string {
  return trust
    .map(
      (value) =>
        `<span class="badge badge-${escapeHtml(value)}">${escapeHtml(value)}</span>`,
    )
    .join(' ');
}

function cites(label: string, ids: string[]): string {
  if (ids.length === 0) {
    return `<p class="cites-empty">cites: none</p>`;
  }
  const items = ids
    .map((id) => `<li><code>${escapeHtml(short(id))}</code></li>`)
    .join('');
  return `<details class="cites"><summary>${escapeHtml(label)}: ${ids.length}</summary><ul>${items}</ul></details>`;
}

function excludedNote(excluded: Record<string, number>): string {
  const parts = Object.entries(excluded)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${count} ${reason}`);
  return parts.length ? `excluded: ${parts.join(', ')}` : 'excluded: none';
}

function bars(distribution: Distribution): string {
  const rows: [string, number | null][] = [
    ['p50', distribution.p50],
    ['p90', distribution.p90],
    ['max', distribution.max],
  ];
  const scale = Math.max(1, ...rows.map(([, value]) => value ?? 0));
  const height = 22;
  const svgRows = rows
    .map(([label, value], index) => {
      const width =
        value === null ? 0 : Math.max(2, Math.round((value / scale) * 220));
      const y = index * height;
      return `<text x="0" y="${y + 15}" class="bar-label">${label}</text><rect x="36" y="${y + 4}" width="${width}" height="14" rx="3" class="bar"></rect><text x="${40 + width}" y="${y + 15}" class="bar-value">${escapeHtml(seconds(value))}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 340 ${height * rows.length}" width="100%" height="${height * rows.length}" role="img" aria-label="p50, p90, and max">${svgRows}</svg>`;
}

function panel(title: string, body: string, meta = ''): string {
  return `<section class="panel"><h3>${escapeHtml(title)}</h3>${meta ? `<p class="meta">${meta}</p>` : ''}${body}</section>`;
}

function distributionPanel(title: string, distribution: Distribution): string {
  const meta = `${trustBadges(distribution.trust)} over ${distribution.count} changes · ${escapeHtml(excludedNote(distribution.excluded))}`;
  return panel(
    title,
    `${bars(distribution)}${cites('changes', distribution.cites)}`,
    meta,
  );
}

function spendRow(label: string, spend: Spend): string {
  return `<tr><td>${escapeHtml(label)}</td><td class="num">$${spend.costUsd.toFixed(2)}</td><td class="num">${(spend.inputTokens + spend.outputTokens).toLocaleString('en-US')}</td><td class="num">${spend.cachedTokens.toLocaleString('en-US')}</td><td class="num">${spend.sessions}</td><td>${cites('records', spend.cites)}</td></tr>`;
}

function spendTable(title: string, rows: Record<string, Spend>): string {
  const entries = Object.entries(rows);
  if (entries.length === 0) {
    return panel(
      title,
      '<p class="empty">No session records with figures.</p>',
    );
  }
  const body = entries.map(([label, spend]) => spendRow(label, spend)).join('');
  return panel(
    title,
    `<table><thead><tr><th>key</th><th class="num">cost</th><th class="num">tokens</th><th class="num">cached</th><th class="num">sessions</th><th>cites</th></tr></thead><tbody>${body}</tbody></table>`,
    `${trustBadges(['reported'])} keyed to ${escapeHtml(title.replace('Spend by ', ''))}, never to a person`,
  );
}

export function renderRepositoryHtml(repository: RepositoryProjection): string {
  const heading = `<h2 id="${escapeHtml(repository.name)}">${escapeHtml(repository.name)} <small>${escapeHtml(repository.defaultBranch)}</small></h2>`;
  if (!repository.reachable) {
    return `<section class="repository">${heading}<p class="warn">Unreachable: ${escapeHtml(repository.reason ?? 'unknown reason')}</p></section>`;
  }
  const signals = repository.signals!;
  if (repository.changes.length === 0) {
    return `<section class="repository">${heading}<p class="empty">No changes on the default branch yet. Merge a pull request through the hooks, then sync and rebuild.</p></section>`;
  }
  const outOfBand = repository.changes.filter(
    (change) =>
      (change.association as { classification: string }).classification ===
      'out-of-band',
  );
  const signalPanels = signals.signals
    .map(
      (signal) =>
        `<section class="panel signal"><h3>Signal: ${escapeHtml(signal.signal)}</h3><p class="meta">observed ${escapeHtml(String(signal.observed))} over threshold ${escapeHtml(String(signal.threshold))}</p>${cites('cites', signal.cites)}</section>`,
    )
    .join('');
  const queueItems = signals.queue.pullRequests
    .map(
      (entry) =>
        `<li><code>#${entry.number}</code> ${entry.commits} commits off the default branch, oldest ${escapeHtml(entry.oldestCommitAt ?? 'unknown')}</li>`,
    )
    .join('');
  const excluded = signals.spend.excluded;
  const excludedLine = `${excluded.undeclared} undeclared, ${excluded.unreported} unreported, ${excluded.humanOnly} human-only, ${excluded.invalidSession} invalid, ${excluded.missingFigures} with figures missing`;
  const effortRows = Object.values(signals.spend.perEffortUnit)
    .map(
      (unit) =>
        `<tr><td>${escapeHtml(unit.unit)}</td><td class="num">${unit.costPerUnit === null ? 'n/a' : '$' + unit.costPerUnit.toFixed(4)}</td><td class="num">${unit.changes}</td><td class="num">${unit.excluded}</td><td>${cites('changes', unit.cites)}</td></tr>`,
    )
    .join('');
  const checks = Object.entries(signals.localChecks)
    .map(([outcome, count]) => `${count} ${escapeHtml(outcome)}`)
    .join(', ');
  return `<section class="repository">${heading}
<p class="asof">Measured as of ${escapeHtml(repository.asOf ?? 'unknown')}, the newest commit the mirror holds. Merge times are the merging party's clock.</p>
${signalPanels}
<div class="grid">
${distributionPanel('Cycle time', signals.cycleTime)}
${distributionPanel('Wait time', signals.waitTime)}
${panel(
  'Unmerged queue',
  `<p class="figure">${signals.queue.count}<span class="unit">pull requests, oldest ${escapeHtml(seconds(signals.queue.oldestAgeSeconds))}</span></p><ul class="list">${queueItems || '<li>none</li>'}</ul>`,
  `${trustBadges(signals.queue.trust)} ${escapeHtml(signals.queue.note)}`,
)}
${panel(
  'Batch size',
  `<p class="figure">${signals.batchSize.medianLines ?? 'n/a'}<span class="unit">median lines, ${signals.batchSize.medianFiles ?? 'n/a'} files, ${signals.batchSize.medianCommits ?? 'n/a'} commits</span></p>${cites('changes', signals.batchSize.cites)}`,
  `${trustBadges(['observed'])} over ${signals.batchSize.count} changes`,
)}
${panel(
  'Merge frequency',
  `<p class="figure">${signals.mergeFrequency.perDay ?? 'n/a'}<span class="unit">per day over ${signals.mergeFrequency.days ?? 'n/a'} days, ${signals.mergeFrequency.changes} changes</span></p>`,
  trustBadges(signals.mergeFrequency.trust),
)}
${panel(
  'Rework',
  `<p class="figure">${signals.rework.pairs.length}<span class="unit">pairs of changes touching the same files within ${signals.rework.windowDays} days</span></p>${cites(
    'pairs',
    signals.rework.pairs.map((pair) => `${pair.later}<-${pair.earlier}`),
  )}`,
  trustBadges(['observed']),
)}
${panel(
  'Escapes',
  `<p class="figure">${signals.escapes.changes.length}<span class="unit">reverts or fixes after ${escapeHtml(signals.escapes.release ?? 'no release')} touching released files</span></p>${cites(
    'changes',
    signals.escapes.changes.map((entry) => entry.change),
  )}`,
  trustBadges(['observed']),
)}
${panel('Local checks', `<p class="figure">${checks || 'none recorded'}</p>`, `${trustBadges(['reported'])} from session records`)}
${panel(
  'Spend total',
  `<p class="figure">$${signals.spend.total.costUsd.toFixed(2)}<span class="unit">${(signals.spend.total.inputTokens + signals.spend.total.outputTokens).toLocaleString('en-US')} tokens over ${signals.spend.total.sessions} sessions</span></p>${cites('records', signals.spend.total.cites)}`,
  `${trustBadges(signals.spend.trust)} excluded: ${escapeHtml(excludedLine)} (counted, never zeroed)`,
)}
${panel(
  'Population',
  `<p class="figure">${outOfBand.length}<span class="unit">out-of-band changes of ${repository.changes.length}; ${repository.unreleased.length} unreleased${repository.movedTags.length ? `; moved tags: ${escapeHtml((repository.movedTags as { tag: string }[]).map((entry) => entry.tag).join(', '))}` : ''}</span></p>${cites(
    'out-of-band',
    outOfBand.map((change) => change.id as string),
  )}`,
  trustBadges(['observed']),
)}
</div>
<div class="grid wide">
${spendTable('Spend by spec', signals.spend.bySpec)}
${spendTable('Spend by provider', signals.spend.byProvider)}
${spendTable('Spend by model', signals.spend.byModel)}
${panel(
  'Cost per unit of effort',
  effortRows
    ? `<table><thead><tr><th>unit</th><th class="num">cost per unit</th><th class="num">changes</th><th class="num">excluded</th><th>cites</th></tr></thead><tbody>${effortRows}</tbody></table>`
    : '<p class="empty">No effort units enabled.</p>',
  `${trustBadges(['reported'])} excluded changes lack the unit or a complete session record`,
)}
${
  signals.spend.unmergedPullRequests.sessions > 0
    ? panel(
        'Spend on unmerged pull requests',
        `<p class="figure">$${signals.spend.unmergedPullRequests.costUsd.toFixed(2)}<span class="unit">over ${signals.spend.unmergedPullRequests.sessions} sessions</span></p>${cites('records', signals.spend.unmergedPullRequests.cites)}`,
        trustBadges(['reported']),
      )
    : ''
}
</div>
</section>`;
}

const STYLE = `
:root { color-scheme: light dark; --bg: #f7f7f5; --panel: #ffffff; --ink: #1c1c1a; --muted: #5f5f5a; --line: #e2e2dd; --accent: #2f6f9f; --observed: #2f6f9f; --reported: #9f6f2f; --signal: #b23a3a; }
@media (prefers-color-scheme: dark) { :root { --bg: #151614; --panel: #1f201d; --ink: #ecebe6; --muted: #a8a7a0; --line: #33342f; --accent: #7fb3d9; --observed: #7fb3d9; --reported: #d9b37f; --signal: #e08080; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { margin-bottom: 20px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 18px; margin: 28px 0 4px; border-top: 1px solid var(--line); padding-top: 16px; }
h2 small { color: var(--muted); font-weight: normal; font-size: 13px; }
h3 { font-size: 13px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.asof, .meta, .cites-empty, .empty { color: var(--muted); font-size: 12px; }
.warn { color: var(--signal); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-top: 12px; }
.grid.wide { grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); }
@media (max-width: 720px) { .grid, .grid.wide { grid-template-columns: 1fr; } }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; min-width: 0; overflow: hidden; }
.panel.signal { border-color: var(--signal); }
.figure { font-size: 26px; margin: 4px 0; }
.figure .unit { display: block; font-size: 12px; color: var(--muted); }
.badge { display: inline-block; padding: 0 6px; border-radius: 10px; font-size: 11px; border: 1px solid currentColor; }
.badge-observed { color: var(--observed); }
.badge-reported { color: var(--reported); }
.bar { fill: var(--accent); }
.bar-label, .bar-value { font-size: 11px; fill: var(--ink); }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
details.cites summary { cursor: pointer; color: var(--muted); font-size: 12px; }
details.cites ul { margin: 4px 0 0; padding-left: 18px; max-height: 160px; overflow: auto; font-size: 12px; }
ul.list { margin: 4px 0 0; padding-left: 18px; font-size: 12px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
footer { margin-top: 28px; color: var(--muted); font-size: 12px; }
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
    .join(' · ');
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
<header>
<h1>The Board</h1>
<p class="meta">${escapeHtml(versions)} · ${repositories.length} repositories registered, ${unreachable.length} unreachable${unreachable.length ? ' (' + escapeHtml(unreachable.map((r) => r.name).join(', ')) + ')' : ''}</p>
<p class="meta">${nav}</p>
</header>
${body}
<footer>Every figure names the trust classes it was computed from and the changes or records behind it. Nothing here is keyed to a person. Reviews, checks, and platform timestamps are not observed; see docs/methodology.md.</footer>
</body>
</html>
`;
}
