# Tasks: Improve Ledger Presentation

## 1. The rename

- [x] 1.1 Rename the requirement through the deltas for `flow-observability` and `ci-governance`, leaving
      the accepted specs untouched so the archive applies the rename; rename every other mention in the
      docs, the roadmap, and the active changes.
- [x] 1.2 Rename the modules: `board.ts` to `ledger.ts`, `board-html.ts` to `ledger-html.ts`, and their
      tests, with `renderBoard` and `renderBoardHtml` following.
- [x] 1.3 Rename the entry points: the `telemetry ledger` subcommand, `scripts/ledger.sh`,
      `npm run ledger`, and the default output `.telemetry/ledger.html`.
- [x] 1.4 Rename the workflow to `ledger.yml` and its steps.
- [x] 1.5 Rename the page title and heading.

## 2. Tabs

- [x] 2.1 Group the panels into four tabs: flow, DORA, spend, and records.
- [x] 2.2 Navigate them with a fragment per tab and CSS `:target`, with no script element and no form
      control.
- [x] 2.3 Render the flow tab by default when no fragment is set, without a script.
- [x] 2.4 Mark the active tab in the nav, generated per repository, degrading to no mark where unsupported.

## 3. Velocity

- [x] 3.1 Carry story points and the count of changes recording none on each weekly bucket.
- [x] 3.2 Compute velocity: story points and changes per week over the measured window, excluding changes
      recording no points with their count stated.
- [x] 3.3 Render it in the flow tab with its trend as inline SVG.

## 4. Documentation

- [x] 4.1 Update `README.md` and `docs/methodology.md` for the rename, the tabs, and velocity.

## 5. Verification

- [x] 5.1 Test that velocity excludes changes recording no points and states the count.
- [x] 5.2 Test that the written page contains no script element, no external resource, and no form control.
- [x] 5.3 Test that the DORA panels and the flow panels are in different tabs, each with its own fragment.
- [x] 5.4 Run `npm run check` and the ledger end to end, recording the result in the pull request.
