# Add Subscription And Operator Spend

## Why

Every dollar figure The Board renders is `$0.00`, over real work. All twelve session records in
`.telemetry/sessions/2026-09/` carry `billingKind: "subscription"`, and validation rejects any subscription
record whose cost is not zero (`packages/capture/src/session.ts:132-137`), so the spend total
(`packages/flow/src/board-html.ts:597`), the per-provider and per-model tables
(`packages/flow/src/board-html.ts:321`), the per-pull-request spend column
(`packages/flow/src/board-html.ts:627`), and cost per unit of recorded effort all read zero and will keep
reading zero for as long as the work is done on a subscription. `notionalCostUsd` was added as the escape
hatch (`packages/capture/src/session.ts:21`, `:121-124`, `:282-286`) and is written by no caller and read by
no projection code.

The zero is not a defect in the validation rule. A subscription session genuinely has no marginal cost; the
cost is a property of the billing period, and no record type in this repository holds one. Nothing records
what a plan costs per month, what period it covers, or what was paid in overage beyond it.

The same records are asymmetric about who did the work. `agentRunSeconds`
(`packages/capture/src/session.ts:27`) and `operatorActiveSeconds` (`packages/capture/src/session.ts:35`)
sit beside each other in one record, but the accepted contract admits only the first to a read: provider and
model are first-class dimensions of both the flow signals
(`openspec/specs/flow-observability/spec.md:183`) and The Board
(`openspec/specs/flow-observability/spec.md:319`), while `No read SHALL be keyed to a person` and `The Board
SHALL NOT present any figure keyed to an operator identifier` exclude the human. The schema is symmetric and
the read is not, so agent labour is observable and the human labour it substitutes for is not. Measuring the
substitution is the question this repository exists to answer.

## What Changes

- Add a committed subscription cost record per billing period holding the plan identifier, the period, the
  amount, the currency, and the overage amount paid beyond the plan.
- Allocate a period's subscription amount across that period's sessions in proportion to `agentRunSeconds`,
  and attribute overage on the same basis.
- Add the trust class `allocated`, distinct from `reported` and `observed`, and carry it on every figure
  derived from an allocation.
- Mark a figure for a period that has not closed as provisional, since its denominator is still growing.
- Admit the operator as a dimension of the flow signals and of The Board, covering agent operators
  (provider and model) and human operators (the pseudonymous `operatorId`) alike.
- Report human effort in hours and agent effort in currency, side by side, never summed into one figure.
- Exclude a change whose commits carry `Session: none` from the human-hours figure with its count stated,
  rather than rendering it as zero hours.
- Enable `costAllocation` in `telemetry.config.json` so records begin carrying `operatorId` and
  `operatorActiveSeconds`.
- Rewrite `docs/methodology.md:115-119`, which argues for the excluded read this change admits.

## Dependencies

`add-session-figures-from-transcript` (archived), which established `agentRunSeconds` and `figuresMissing`
as recorded facts; this change reads both as the basis and the exclusion rule for allocation. No active
change is required first.

## Non-Goals

- No hourly rate, salary, or currency figure for a human operator. `FORBIDDEN_SESSION_KEYS`
  (`packages/capture/src/session.ts:42`) keeps rejecting `hourlyRate`, `rate`, `salary`, and `compensation`,
  and gains no exception.
- No name or email address in any record, and no resolution of a pseudonymous `operatorId` to a person.
  `isPseudonymousId` (`packages/capture/src/config.ts:143`) stays as the gate.
- No conversion of human hours into money anywhere in the projection or on The Board.
- No retrieval of any cost figure from a model provider's API. `Capture needs no credential and no network`
  (`openspec/specs/telemetry-capture/spec.md:177`) is unchanged; a subscription amount is entered by the
  operator, not fetched.
- No backfill. The twelve existing records carry no `operatorId` and none is invented for them.
- No publication of The Board to any hosting surface; that is `add-board-publication`, which depends on this
  change.
