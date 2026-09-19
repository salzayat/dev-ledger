# Tasks: Add Timesheets

- [x] 1.1 ~3 `packages/capture/src/timesheets.ts` and `telemetry timesheet close`: the record, validation
      against the declared operators, the proposal from the period's session records, open-period and
      overwrite guards; `validate` covers it.
- [x] 1.2 ~3 `packages/flow`: read timesheets; hours by operator, spec, and month with confirmed beside
      measured.
- [x] 1.3 ~2 The Ledger: the hours panel and terminal line.
- [x] 2.1 ~1 Docs, contract, README, roadmap.
- [x] 3.1 ~2 Tests: close proposes by spec and commits nothing and refuses an open period; the projection
      carries measured and confirmed hours per month.
- [x] 3.2 ~1 `npm run check`; a rebuild over this repository recorded in the pull request. Evidence
      (2026-09-19): sha256 `ce9ff80f…`; hours 14.8 h measured, 0.0 h confirmed, all under
      `(no operator identifier)` over 4 sessions, so `timesheet close 2026-09` has nothing to propose until
      records carry the identifier set in this checkout.
