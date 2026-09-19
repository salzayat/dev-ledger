# Redesign Ledger Presentation

## Why

The page holds the right figures and buries them. Every panel is emitted as heading, then trust badges
and a methodology sentence, then the figure (`packages/flow/src/ledger-html.ts:428-436`), so a reader
passes a paragraph before reaching the number the panel exists to show. The flow tab is one auto-fit grid
of twelve equal cards with work mix first and wait time seventh (`ledger-html.ts:1219-1290`); nothing on
it says where to start. The summary strip lists seven stats in a `minmax(150px, 1fr)` grid
(`ledger-html.ts:1073-1096`, `.stats` at `ledger-html.ts:1421-1424`), which orphans the seventh onto a
second row and wraps `$100.00 (provisional)` and `subscription` mid-word at common widths. The first line
under the page title is the projection, session, and registry schema versions (`ledger-html.ts:1532-1534`),
which answers nothing a visitor came to ask. The recent-changes table leads with ten columns
(`ledger-html.ts:795-815`) and scrolls sideways at every width, so the three that matter compete with
session identifiers and gap tags.

The accepted requirement already asks that panels be grouped by the question each answers and that flow
and DORA sit apart. This change keeps every figure, trust class, excluded count, and citation the spec
requires and reorders the page so the figure leads, the question groups the panels, and the methodology
and citations are one click beneath.

## What Changes

- Two-level tabs. Three top-level views, Metrics, Economics, and Records, each with sub-views: Metrics
  holds Flow, DORA, and Throughput; Economics holds Spend and Effort; Records holds Changes, Queue, and
  Notes. Every sub-view is a fragment selected by CSS; the parent marks itself active when any of its
  sub-views is targeted. No script, no form control, unchanged.
- A headline: one sentence in words naming the typical wait, cycle, active share, and the period's spend,
  each figure linking to the view that holds its panel, followed by five figures with a trend beside each:
  typical wait, typical cycle, the queue, merges per day, and the period's spend.
- Panels lead with the figure. The order becomes title and trust classes, figure, chart or table, then a
  folded "How it's measured" holding the methodology note, the excluded count, and the help text, then the
  citations. Nothing the panel showed is removed.
- Panels are grouped under a question. Each sub-view is one or more groups with a heading such as "Where
  does work wait?" and a one-line subtitle; velocity, merge frequency, batch size, and work mix move to
  Throughput; hours, operators, cost per unit of effort, and unmerged spend move to Effort.
- Trust classes render as a colored dot and word beside the panel title, with one legend in the top bar,
  instead of a badge row inside each panel's prose.
- The schema versions move to the footer. The top bar carries the page name, repository, branch, web URL,
  the trust legend, and the as-of date.
- The recent-changes table leads with merged, change, pull request, wait, cycle, spend, and hours; lines,
  sessions, and gaps disclose per row.
- Flat surfaces: panels sit in one bordered grid separated by hairlines; the headline strip is the only
  elevated object.
- `docs/methodology.md`, `README.md`, and `plans/roadmap.md` describe the new structure.

## Dependencies

`remove-zero-figures`, archived, for the absence rules the new panels keep.

## Non-Goals

- No change to `packages/flow/src/signals.ts`, `projection.ts`, or the terminal render in `ledger.ts`;
  every figure on the page is one the projection already carries.
- No script element, no external resource, no form control, no loaded font: `ledger-html.test.ts`
  keeps asserting all four.
- No new figure. The headline sentence composes figures the page already shows and links to them; it
  carries no number that lacks a panel.
- No change to the registry rollup section's content; it takes the new panel styling only.
