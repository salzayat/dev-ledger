# Improve Ledger Presentation

## Why

The read surface is called The Board in a repository called `dev-ledger`, and the name has never carried its
weight. A board is a status display — something you glance at — while what this renders is an account of what
happened, traceable to the records behind every figure. The Ledger says that, and it says it in the
repository's own vocabulary.

The page has also outgrown one column. It now carries flow signals, the DORA strip approximated to the
release tag, spend by spec, provider, model and operator, subscription allocation and its rate, weekly
trends, cost classes, coverage, the unmerged queue, and the recent-changes table. Rendered as one scroll,
DORA sits between flow figures that answer a different question, and a reader looking for either has to know
where it lives.

Nothing reports throughput in the unit the configuration already enables. `telemetry.config.json` has story
points on, every change may carry a `Story-Points:` trailer, and `openspec/specs/flow-observability/spec.md`
computes cost per unit of effort from them — but no read says how much shipped per week, which is the first
question anyone asks of a delivery record.

## What Changes

- Rename The Board to The Ledger everywhere it is named: the accepted requirement, the specs, the docs, the
  `telemetry ledger` subcommand, `npm run ledger`, `scripts/ledger.sh`, the workflow, and the page title.
- Group the page into tabs, navigated without script: an anchor per tab and CSS `:target`, so the page stays
  one self-contained file with no script element, no external resource, and no form control.
- Put DORA and flow in separate tabs, and organise the rest by the question each panel answers rather than
  by the order it was built.
- Add velocity: story points and changes merged per week over the measured window, with the trend rendered
  as inline SVG beside the figures, excluding changes that recorded no points with their count stated.

## Dependencies

None. Every change this touches is archived, and no active change is required first.

## Non-Goals

- No script element, no external resource, and no form control on the published page. Tabs are anchors and
  CSS; `openspec/specs/flow-observability/spec.md:413` is unchanged and the self-contained test is extended
  to cover tabs rather than relaxed for them.
- No compatibility alias for the old names. `telemetry board` and `npm run board` are renamed, not
  duplicated, as this repository's own guidance on speculative compatibility layers requires.
- No velocity figure keyed to a person, and no per-operator throughput. Velocity is per repository and per
  week, as every other flow read is.
- No new record, trailer, or configuration field. Velocity is computed from story points already recorded
  and changes already grouped.
