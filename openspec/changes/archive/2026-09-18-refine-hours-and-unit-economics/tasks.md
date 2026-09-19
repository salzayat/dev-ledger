# Tasks: Refine Hours And Unit Economics

- [x] 1.1 ~3 `packages/capture/src/cli.ts`: attribute transcript time inside the session window; warn when
      no operator is configured; test that events outside the window do not count.
- [x] 1.2 ~2 `packages/flow/src/signals.ts`: hours without an identifier kept under `(no operator identifier)`.
- [x] 1.3 ~3 `signals.ts`: `allocated` and `currency` on every cost-per figure and effort unit; `tasks` and
      `taskComplexity` units from each change's task list.
- [x] 1.4 ~2 `ledger-html.ts`: allocated first in the strip, "provisional" in words, no clipping; the effort
      table shows allocated and reported per unit.
- [x] 2.1 ~1 Docs: methodology and contract; roadmap row; a note on the page about inflated early hours.
- [x] 3.1 ~2 Tests: unidentified hours appear; allocated cost per task complexity over a fixture.
- [x] 3.2 ~1 `npm run check`; a rebuild over this repository recorded in the pull request. Evidence
      (2026-09-18): sha256 `69456690…`; allocated cost per task complexity $0.87 over 6 changes, per merged
      change $6.66 over 11; hours under `(no operator identifier)` 14.75 h over 4 sessions, where the page
      had read none.
