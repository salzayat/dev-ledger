import type { RepositoryProjection } from './projection.ts';
import {
  escapeHtml,
  panel,
  trustBadges,
  cites,
  count,
  type Links,
} from './ledger-html.ts';

/**
 * Configuration gaps, each with the command that closes it.
 *
 * This lives in its own module because the published page must not carry it. Subscription configuration
 * names plan identifiers, the periods they cover, and the files that hold them, and the published page is
 * world readable; keeping the markup in a module the published renderer never imports is what makes its
 * absence containment rather than a hidden element someone could reveal.
 */
export function configurationPanel(
  repository: RepositoryProjection,
  links: Links,
): string {
  const gaps = repository.configurationGaps ?? [];
  if (gaps.length === 0) {
    return panel(
      'Subscription configuration',
      '<p class="empty">Every declared plan has a record for every closed period, and every session names a plan that exists.</p>',
      `${trustBadges(['reported'])} declarations, cost records, and the sessions that cite them`,
    );
  }
  const label: Record<string, string> = {
    'missing-record': 'no record for a closed period',
    'undeclared-plan': 'a record for a plan no declaration covers',
    'unknown-subscription': 'a session naming a plan with no record',
    'uncovered-period': 'no interval covers this period',
  };
  const rows = gaps
    .map(
      (gap) =>
        `<tr><td>${escapeHtml(gap.subject)}</td><td class="mono">${escapeHtml(gap.period ?? '')}</td><td>${escapeHtml(label[gap.kind] ?? gap.kind)}</td><td><code>${escapeHtml(gap.remedy)}</code></td><td>${cites('records', gap.cites, links)}</td></tr>`,
    )
    .join('');
  return panel(
    'Subscription configuration',
    `<div class="scroll"><table><thead><tr><th>plan</th><th>period</th><th>gap</th><th>closes it</th><th>cites</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    `${trustBadges(['reported'])} ${count(gaps.length, 'gap')} between the declarations, the records, and the sessions; the page names them and changes nothing`,
  );
}

/**
 * The locally served page: the configuration panel and the editor, which the published artifact never
 * carries. A form is allowed here precisely because this page is not the published one — it is served from
 * the loopback interface to the operator who started it.
 */
export function renderConfigurationPage(
  repositories: RepositoryProjection[],
  links: Links,
  plansJson: string,
): string {
  const panels = repositories
    .map((repository) => configurationPanel(repository, links))
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ledger configuration (local)</title>
<style>
body { margin: 0; padding: 24px; font: 14px/1.5 system-ui, sans-serif; background: #f4f5f3; color: #16181a; }
.wrap { max-width: 980px; margin: 0 auto; }
.panel { background: #fff; border: 1px solid #e0e2dd; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e0e2dd; font-size: 13px; }
textarea { width: 100%; min-height: 220px; font: 12px/1.5 ui-monospace, monospace; }
button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid #cbcec8; background: #fff; cursor: pointer; }
.local { background: #fdf0df; border: 1px solid #e8c48a; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; }
.num { text-align: right; }
.dim { color: #5f6368; }
</style>
</head>
<body>
<div class="wrap">
<h1>Ledger configuration</h1>
<p class="local"><strong>Local only.</strong> This page is served on the loopback interface from your working
copy. It is not part of the published ledger, which carries no configuration and no editor. Saving writes the
file and nothing else: no commit, no staging, no git. Review the diff and commit it yourself.</p>
${panels}
<section class="panel">
<h2>Plan declarations</h2>
<p class="dim">What each plan is arranged to cost. A price or seat change appends an interval; it never
rewrites one.</p>
<form id="plans">
<textarea name="body" spellcheck="false">${escapeHtml(plansJson)}</textarea>
<p><button type="submit">Save to the working copy</button> <span id="result" class="dim"></span></p>
</form>
</section>
</div>
<script>
document.getElementById('plans').addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = document.getElementById('result');
  let body;
  try {
    body = JSON.parse(event.target.body.value);
  } catch (error) {
    result.textContent = 'not valid JSON: ' + error.message;
    return;
  }
  const response = await fetch('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: '.telemetry/subscriptions/plans.json', body }),
  });
  const outcome = await response.json();
  result.textContent = outcome.ok
    ? 'written to ' + outcome.path + '; review the diff and commit'
    : outcome.errors.join('; ');
});
</script>
</body>
</html>
`;
}
