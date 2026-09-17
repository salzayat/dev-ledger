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

function short(id: string): string {
  return id
    .split('<-')
    .map((part) => (/^[0-9a-f]{40}$/.test(part) ? part.slice(0, 10) : part))
    .join(' ← ');
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

function distributionPanel(
  title: string,
  distribution: Distribution,
  help: string,
): string {
  const meta = `${trustBadges(distribution.trust)} over ${distribution.count} changes · ${escapeHtml(excludedNote(distribution.excluded))}`;
  const body =
    distribution.count === 0
      ? `<p class="empty">No change with a pull head ref yet, so nothing to time.</p>`
      : `${bars(distribution)}<p class="help">${escapeHtml(help)}</p>${cites('changes', distribution.cites)}`;
  return panel(title, body, meta);
}

function spendRow(label: string, spend: Spend): string {
  return `<tr><td>${escapeHtml(label)}</td><td class="num">$${spend.costUsd.toFixed(2)}</td><td class="num">${(spend.inputTokens + spend.outputTokens).toLocaleString('en-US')}</td><td class="num">${spend.cachedTokens.toLocaleString('en-US')}</td><td class="num">${spend.sessions}</td><td>${cites('records', spend.cites)}</td></tr>`;
}

function spendTable(
  title: string,
  rows: Record<string, Spend>,
  missingFigures: number,
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
  const body = entries
    .sort(([, a], [, b]) => b.costUsd - a.costUsd)
    .map(([label, spend]) => spendRow(label, spend))
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

function changesTable(changes: ChangeRow[]): string {
  const recent = [...changes].reverse().slice(0, 15);
  const rows = recent
    .map((change) => {
      const pull =
        change.association.pullRequest === null
          ? `<span class="warn">out-of-band</span>`
          : `#${change.association.pullRequest} <span class="dim">${escapeHtml(change.association.method ?? '')}</span>`;
      const sessions =
        change.sessions.status === 'declared'
          ? change.sessions.sessions.length
            ? escapeHtml(change.sessions.sessions.join(', '))
            : `<span class="warn">unreported</span>`
          : `<span class="${change.sessions.status === 'undeclared' ? 'warn' : 'dim'}">${escapeHtml(change.sessions.status)}</span>`;
      const gaps = change.gaps
        .map((gap) => `<span class="gap">${escapeHtml(gap.type)}</span>`)
        .join(' ');
      return `<tr><td class="mono">${escapeHtml(dateOnly(change.mergeTime))}</td><td class="subject" title="${escapeHtml(change.id)}">${escapeHtml(change.subject)}</td><td>${pull}</td><td class="num">${escapeHtml(seconds(change.timing.waitTimeSeconds))}</td><td class="num">${escapeHtml(seconds(change.timing.cycleTimeSeconds))}</td><td class="num">+${change.insertions} −${change.deletions}</td><td>${sessions}</td><td>${gaps || '<span class="dim">none</span>'}</td></tr>`;
    })
    .join('');
  return panel(
    'Recent changes',
    `<div class="scroll"><table class="changes"><thead><tr><th>merged</th><th>change</th><th>pull request</th><th class="num">wait</th><th class="num">cycle</th><th class="num">lines</th><th>sessions</th><th>gaps</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    `${trustBadges(['observed'])} the newest ${recent.length} of ${changes.length} changes on the default branch; wait and cycle come from the pull head ref, sessions from the harness`,
    'span-all',
  );
}

function topFiles(pairs: { files: string[] }[], limit = 8): string {
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
  return `<ul class="list">${top.map(([file, count]) => `<li><code>${escapeHtml(file)}</code> <span class="dim">in ${count} pairs</span></li>`).join('')}</ul>`;
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
  const changes = repository.changes as unknown as ChangeRow[];
  const outOfBand = changes.filter(
    (change) => change.association.classification === 'out-of-band',
  );
  const excluded = signals.spend.excluded;
  const summary = [
    ['wait p50', seconds(signals.waitTime.p50), 'observed'],
    ['cycle p50', seconds(signals.cycleTime.p50), 'observed'],
    ['queue', `${signals.queue.count}`, 'observed'],
    ['merges / day', `${signals.mergeFrequency.perDay ?? 'n/a'}`, 'observed'],
    ['spend', `$${signals.spend.total.costUsd.toFixed(2)}`, 'reported'],
    ['out-of-band', `${outOfBand.length}`, 'observed'],
  ]
    .map(
      ([label, value, trust]) =>
        `<div class="stat"><span class="stat-value">${escapeHtml(value)}</span><span class="stat-label">${escapeHtml(label)} ${trustBadges([trust])}</span></div>`,
    )
    .join('');
  const signalPanels = signals.signals
    .map(
      (signal) =>
        `<section class="panel signal"><h3>Signal: ${escapeHtml(signal.signal)}</h3><p class="meta">observed ${escapeHtml(seconds(signal.observed))} over the registry threshold of ${escapeHtml(seconds(signal.threshold))}</p>${cites('changes', signal.cites)}</section>`,
    )
    .join('');
  const queueRows = [...signals.queue.pullRequests]
    .map((entry) => ({
      ...entry,
      age: ageFrom(repository.asOf, entry.oldestCommitAt),
    }))
    .sort((a, b) => (b.age ?? -1) - (a.age ?? -1))
    .map(
      (entry) =>
        `<tr><td><code>#${entry.number}</code></td><td class="num">${escapeHtml(seconds(entry.age))}</td><td class="num">${entry.commits}</td><td class="mono">${escapeHtml(dateOnly(entry.oldestCommitAt))}</td></tr>`,
    )
    .join('');
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
<p class="asof">Measured as of ${escapeHtml(dateOnly(repository.asOf))}, the newest commit the mirror holds. Merge times are the merging party's clock.</p>
<div class="stats">${summary}</div>
${signalPanels}
<div class="grid">
${distributionPanel('Wait time', signals.waitTime, 'From the last commit on the pull request to the merge: how long finished work sat.')}
${distributionPanel('Cycle time', signals.cycleTime, 'From the first commit on the pull request to the merge.')}
${panel(
  'Unmerged queue',
  `${figure(String(signals.queue.count), `pull requests, oldest ${escapeHtml(seconds(signals.queue.oldestAgeSeconds))}`)}${
    queueRows
      ? `<div class="scroll"><table><thead><tr><th>pull request</th><th class="num">age</th><th class="num">commits</th><th>oldest commit</th></tr></thead><tbody>${queueRows}</tbody></table></div>`
      : '<p class="empty">Nothing waiting.</p>'
  }`,
  `${trustBadges(signals.queue.trust)} ${escapeHtml(signals.queue.note)}`,
)}
${panel(
  'Batch size',
  `${figure(String(signals.batchSize.medianLines ?? 'n/a'), `median lines changed; ${signals.batchSize.medianFiles ?? 'n/a'} files and ${signals.batchSize.medianCommits ?? 'n/a'} commits per change`)}${cites('changes', signals.batchSize.cites)}`,
  `${trustBadges(['observed'])} over ${signals.batchSize.count} changes`,
)}
${panel(
  'Merge frequency',
  figure(
    String(signals.mergeFrequency.perDay ?? 'n/a'),
    `per day over ${signals.mergeFrequency.days ?? 'n/a'} days, ${signals.mergeFrequency.changes} changes`,
  ),
  trustBadges(signals.mergeFrequency.trust),
)}
${panel(
  'Rework',
  `${figure(String(signals.rework.pairs.length), `pairs of changes touching the same file within ${signals.rework.windowDays} days`)}${topFiles(signals.rework.pairs)}${cites(
    'pairs',
    signals.rework.pairs.map((pair) => `${pair.later}<-${pair.earlier}`),
  )}`,
  `${trustBadges(['observed'])} most-touched files first`,
)}
${panel(
  'Escapes',
  `${figure(String(signals.escapes.changes.length), `reverts or fixes after ${escapeHtml(signals.escapes.release ?? 'no release')} touching released files`)}${cites(
    'changes',
    signals.escapes.changes.map((entry) => entry.change),
  )}`,
  trustBadges(['observed']),
)}
${panel('Local checks', figure(checks || 'none', checks ? 'session records with a check outcome' : 'no session recorded a check outcome yet'), `${trustBadges(['reported'])} from session records`)}
${panel(
  'Spend',
  `${figure(`$${signals.spend.total.costUsd.toFixed(2)}`, `${(signals.spend.total.inputTokens + signals.spend.total.outputTokens).toLocaleString('en-US')} tokens over ${signals.spend.total.sessions} sessions with figures`)}${cites('records', signals.spend.total.cites)}`,
  `${trustBadges(signals.spend.trust)} excluded: ${escapeHtml(excludedLine)} (counted, never zeroed)`,
)}
${panel(
  'Population',
  `${figure(String(outOfBand.length), `out-of-band changes of ${changes.length}; ${repository.unreleased.length} unreleased${repository.movedTags.length ? `; moved tags: ${escapeHtml((repository.movedTags as { tag: string }[]).map((entry) => entry.tag).join(', '))}` : ''}`)}${cites(
    'out-of-band',
    outOfBand.map((change) => change.id),
  )}`,
  trustBadges(['observed']),
)}
</div>
${changesTable(changes)}
<div class="grid wide">
${spendTable('Spend by spec', signals.spend.bySpec, excluded.missingFigures)}
${spendTable('Spend by provider', signals.spend.byProvider, excluded.missingFigures)}
${spendTable('Spend by model', signals.spend.byModel, excluded.missingFigures)}
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
        `${figure(`$${signals.spend.unmergedPullRequests.costUsd.toFixed(2)}`, `over ${signals.spend.unmergedPullRequests.sessions} sessions`)}${cites('records', signals.spend.unmergedPullRequests.cites)}`,
        trustBadges(['reported']),
      )
    : ''
}
</div>
</section>`;
}

const STYLE = `
:root { color-scheme: light dark; --bg: #f6f6f3; --panel: #ffffff; --ink: #1c1c1a; --muted: #62625c; --line: #e1e1db; --accent: #2f6f9f; --observed: #2f6f9f; --reported: #9f6f2f; --signal: #b23a3a; --gap: #fff1e0; --gap-ink: #7a4a10; }
@media (prefers-color-scheme: dark) { :root { --bg: #141513; --panel: #1e1f1c; --ink: #ecebe6; --muted: #a6a59e; --line: #32332e; --accent: #7fb3d9; --observed: #7fb3d9; --reported: #d9b37f; --signal: #e08080; --gap: #3a2a12; --gap-ink: #e8c48a; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 20px 16px 32px; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { margin-bottom: 8px; }
h1 { font-size: 24px; margin: 0 0 4px; }
h2 { font-size: 20px; margin: 36px 0 4px; border-top: 1px solid var(--line); padding-top: 20px; }
h2 small { color: var(--muted); font-weight: normal; font-size: 13px; }
h3 { font-size: 12px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.asof, .meta, .cites-empty, .empty, .help, .dim { color: var(--muted); font-size: 12px; }
.help { margin: 4px 0 0; }
.warn { color: var(--signal); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin: 12px 0 16px; }
.stat { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.stat-value { display: block; font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
.stat-label { display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-top: 12px; }
.grid.wide { grid-template-columns: repeat(auto-fill, minmax(440px, 1fr)); }
@media (max-width: 720px) { .grid, .grid.wide { grid-template-columns: 1fr; } }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; min-width: 0; overflow: hidden; }
.panel.signal { border-color: var(--signal); margin-top: 12px; }
.panel.span-all { margin-top: 12px; }
.figure { font-size: 26px; margin: 4px 0; font-variant-numeric: tabular-nums; }
.figure .unit { display: block; font-size: 12px; color: var(--muted); font-weight: normal; }
.badge { display: inline-block; padding: 0 6px; border-radius: 10px; font-size: 10px; border: 1px solid currentColor; vertical-align: middle; text-transform: none; letter-spacing: 0; }
.badge-observed { color: var(--observed); }
.badge-reported { color: var(--reported); }
.gap { display: inline-block; padding: 0 6px; border-radius: 4px; font-size: 11px; background: var(--gap); color: var(--gap-ink); }
.bar { fill: var(--accent); }
.bar-label, .bar-value { font-size: 11px; fill: var(--ink); }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--line); vertical-align: top; white-space: nowrap; }
td.subject { white-space: normal; min-width: 220px; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.mono, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
details.cites summary { cursor: pointer; color: var(--muted); font-size: 12px; }
details.cites ul { margin: 4px 0 0; padding-left: 18px; max-height: 160px; overflow: auto; font-size: 12px; }
ul.list { margin: 6px 0 0; padding-left: 18px; font-size: 12px; }
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
