# Tasks: Add DORA Signals

## Signals

- [x] 1.1 `packages/flow/src/signals.ts`: `dora` with deployment frequency (releases per week, citing
      tags), lead time to release (distribution from first commit to the carrying tag, with the
      merge-to-tag interval reported separately and unreleased changes excluded by reason), change failure
      rate (escapes per release with the denominator), and time to fix (distribution from the targeted
      released change's merge to the escape's merge, targets resolved by revert reference or shared files).
- [x] 1.2 `trends`: weekly buckets of merged changes and session cost over the measured window, each
      citing its changes and records.
- [x] 1.3 `costClasses`: spend by `rd`, `production`, and `unclassified` from the session's cost class or
      the change's `Cost-Class:` trailer, with missing-figure counts; `coverage`: changes with an agent
      session, human-only, undeclared, unreported.
- [x] 1.4 `packages/flow/src/projection.ts`: pass each release's tag date to the signals;
      `PROJECTION_SCHEMA_VERSION` 4.
- [x] 1.5 Tests over fixture repositories: releases per week, lead time to release excludes unreleased
      changes, change failure rate with its denominator, time to fix from a revert and from a shared-file
      fix, weekly buckets, cost classes from session and trailer with `unclassified` never defaulted.

## The Board

- [x] 2.1 HTML: a DORA strip of four cards with the approximation note on each, a spend-over-time column
      chart beside the merge-activity chart, and a cost-class panel; terminal render: the same figures as
      lines.
- [x] 2.2 `docs/methodology.md`: "DORA, approximated to the release tag" and "Cost by class".
- [x] 2.3 `docs/contract.md`: the new projection fields; README key figures mention DORA.
- [x] 2.4 `plans/roadmap.md`: this change as a phase one addendum.

## Verification

- [x] 3.1 `npm run check` passes (2026-09-17, on this branch, and again through the pre-commit hook).
- [x] 3.2 End to end: rebuild over this repository and confirm the DORA strip, the weekly charts, and the
      cost-class panel render with citations, and that every approximation note is present.
      Evidence (2026-09-17): over this repository's `main` the terminal render reported one release, lead time
      to release typical 20.8 days (20.7 days of it merge to tag), 0 escapes over 1 release, time to fix n/a
      over 0, spend by cost class `unclassified` with 11 records without figures, and coverage 10 with an
      agent session of 47 changes; the HTML page served statically showed the four DORA cards with their
      notes and citations, the spend-over-time chart, and the cost-class panel.
