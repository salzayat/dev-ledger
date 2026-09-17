# Tasks: Add Subscription And Operator Spend

## 1. Subscription cost records

- [ ] 1.1 Define the subscription cost record type in `packages/capture/src/`: `schemaVersion`, `planId`,
      `period` (`YYYY-MM`), `amount`, `currency`, `overageAmount`, and its file path under
      `.telemetry/subscriptions/<period>.json`.
- [ ] 1.2 Validate the record: non-negative `amount` and `overageAmount`, a well-formed `period`, and
      rejection of the same `FORBIDDEN_SESSION_KEYS` vocabulary so a rate or a salary cannot enter it.
- [ ] 1.3 Add a `telemetry subscription` subcommand to write and validate one, and wire it into
      `scripts/telemetry.sh` alongside the existing `session` and `validate` subcommands.
- [ ] 1.4 Extend `scripts/check-secrets.sh` coverage to the new directory if it enumerates paths explicitly.

## 2. Allocation in the projection

- [ ] 2.1 Load subscription cost records in `packages/flow/src/projection.ts` and join each to the sessions
      whose `endedAt` falls in its period.
- [ ] 2.2 Allocate each period's `amount` across its sessions in proportion to `agentRunSeconds`, and
      allocate `overageAmount` on the same basis as a separately reported component.
- [ ] 2.3 Exclude any session with `agentRunSeconds` of zero from the allocation and carry its count; when a
      period has no session with non-zero agent seconds, report the whole amount as unallocated.
- [ ] 2.4 Compute allocated figures independently of `figuresMissing`, and keep the excluded counts for
      reported figures and allocated figures separate.
- [ ] 2.5 Mark a figure drawn from a period whose end has not passed as provisional.
- [ ] 2.6 Add `allocated` to the trust-class vocabulary and carry it on every allocated figure, citing the
      subscription cost record and the session records behind it.

## 3. The operator dimension

- [ ] 3.1 Add the operator dimension to the flow signals in `packages/flow/src/signals.ts`, covering agent
      operators (provider and model) and human operators (`operatorId`).
- [ ] 3.2 Compute human effort in hours from `operatorActiveSeconds`, and keep it in a separate figure from
      any currency amount.
- [ ] 3.3 Exclude changes carrying `Session: none` from the human-hours figure with their count stated.
- [ ] 3.4 Exclude sessions predating `costAllocation` being enabled, which carry no `operatorId`, with their
      count stated.

## 4. The Board

- [ ] 4.1 Render allocated spend where `$0.00` is rendered today: the spend total
      (`packages/flow/src/board-html.ts:597`), the per-provider and per-model tables (`:321`), and the
      per-pull-request spend column (`:627`).
- [ ] 4.2 Render the trust class `allocated` and the provisional marker beside each allocated figure,
      reusing the existing class rendering at `packages/flow/src/board-html.ts:491`.
- [ ] 4.3 Render the operator panel with human hours and agent currency side by side, and no summed total
      across the two units.
- [ ] 4.4 Render the terminal board in `packages/flow/src/board.ts` to match.
- [ ] 4.5 Keep the page self-contained: no script element, no external resource, light and dark, phone
      width.

## 5. Configuration and documentation

- [ ] 5.1 Set `costAllocation.enabled` to `true` in `telemetry.config.json`.
- [ ] 5.2 Rewrite `docs/methodology.md:115-119`, which argues for the excluded read this change admits, and
      state the allocation basis, the provisional rule, and the hours-never-money boundary.
- [ ] 5.3 Document the subscription record and the `telemetry subscription` subcommand in `README.md` and
      `docs/` wherever the session record is documented.
- [ ] 5.4 Record the first real subscription cost record for the current period.

## 6. Verification

- [ ] 6.1 Test that a period's allocated amounts over sessions with non-zero agent seconds sum to that
      period's amount, and that the sum is unchanged by the presence of zero-second sessions.
- [ ] 6.2 Test that a session with `agentRunSeconds: 0` receives no allocation and is reported in the
      excluded count, and is never rendered as zero cost.
- [ ] 6.3 Test that a period in which every session has zero agent seconds reports its whole amount as
      unallocated rather than spreading it evenly.
- [ ] 6.4 Test that a record carrying `figuresMissing` with non-zero `agentRunSeconds` still takes an
      allocated share, and that its reported-figure exclusion is counted separately.
- [ ] 6.5 Test that a figure from an open period renders provisional and one from a closed period does not.
- [ ] 6.6 Test that no read and no rendered page multiplies `operatorActiveSeconds` by any rate, and that a
      record carrying `hourlyRate`, `rate`, `salary`, or `compensation` is still rejected.
- [ ] 6.7 Test that a subscription cost record with a non-pseudonymous operator entry is rejected.
- [ ] 6.8 Test that changes carrying `Session: none` are excluded from human hours with their count stated.
- [ ] 6.9 Test that the rebuilt projection is byte-identical across two rebuilds from the same records and
      the same subscription cost records.
- [ ] 6.10 Run `npm run check`, and run `./scripts/telemetry.sh board --html` end to end, recording the
      result in the pull request.
