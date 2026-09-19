# Tasks: Add Registry Rollup And Statements

- [x] 1.1 ~3 `packages/flow/src/rollup.ts`: spend by spec and class, hours, velocity across reachable
      repositories; `projection.registry`.
- [x] 1.2 ~2 The Ledger: the "All repositories" section when more than one repository is registered.
- [x] 1.3 ~3 `packages/flow/src/statement.ts` and `telemetry export`: period rows as CSV or JSON, each with
      trust and scope.
- [x] 2.1 ~1 Docs, contract, README, roadmap.
- [x] 3.1 ~2 Test: two repositories sharing a spec sum to one row; the statement carries the period's
      allocations and hours and no period rows for an empty month.
- [x] 3.2 ~1 `npm run check`; an export over this repository recorded in the pull request. Evidence
      (2026-09-19): rebuild sha256 `173dc796…`; `export --period 2026-09` wrote 18 rows, among them the
      $100.00 provisional allocation for `claude-max` and 14.76 measured hours under
      `(no operator identifier)`; the rollup section stays hidden with one repository registered.
