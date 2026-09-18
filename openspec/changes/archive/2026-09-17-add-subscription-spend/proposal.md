# Add Subscription Spend

## Why

Every dollar figure The Board renders is `$0.00`, over real work. All sixteen session records in
`.telemetry/sessions/2026-09/` carry `billingKind: "subscription"`, and validation rejects any subscription
record whose cost is not zero (`packages/capture/src/session.ts`), so the spend total, the per-provider and
per-model tables, the per-pull-request spend column, and cost per unit of recorded effort all read zero and
will keep reading zero for as long as the work is done on a subscription.

The zero is not a defect in the validation rule. A subscription session has no marginal cost; the cost is a
property of the billing period, and no record type in this repository holds one. Nothing records what a plan
costs per month, what period it covers, or what was paid in overage beyond it.

This change was drafted as `add-subscription-and-operator-spend`, which also admitted the operator as a
dimension of the flow reads. That half reverses an accepted requirement and a published position, so it is
split out as `add-operator-dimension` for the repository owner to decide on its own. Nothing here depends on
it.

## What Changes

- Add a committed subscription cost record per billing period and plan, under
  `.telemetry/subscriptions/<period>/<plan>.json`, holding the plan identifier, the period, the amount, the
  currency, and the overage amount paid beyond the plan. `telemetry subscription record` writes one.
- Allocate a period's amount across the sessions that end in it and name its plan, in proportion to
  `agentRunSeconds`, and allocate overage on the same basis as a separately reported component.
- Add the trust class `allocated`, distinct from `reported` and `observed`, carried on every figure derived
  from an allocation, which also names its basis and cites the period record and the session records behind
  it.
- Exclude a session with no agent run seconds from the allocation and count it; when no session in a period
  can take a share, report the period's whole amount as unallocated. A session on a plan with no record for
  its period is excluded and counted too.
- Mark a figure from a period whose end has not passed, as of the newest commit the mirror holds, as
  provisional.
- Render the allocated figures where `$0.00` is rendered today: a stat in the summary strip, a subscription
  spend panel of periods, an allocated column on the spend tables, and the allocated share in the queue and
  changes tables. `PROJECTION_SCHEMA_VERSION` goes to 5.

## Dependencies

`add-session-figures-from-transcript` (archived), which established `agentRunSeconds` and `figuresMissing`
as recorded facts; this change reads both as the basis and the exclusion rule for allocation.

`add-flow-efficiency-and-work-mix` (active, `Pending`) modifies `Flow signals per repository and in
aggregate`. This change does not, so the two archive in either order.

## Non-Goals

- No operator dimension, no human hours, no `costAllocation` enabled: `add-operator-dimension`.
- No hourly rate, salary, or currency figure for a person. The subscription cost record rejects the same
  forbidden keys a session record does.
- No retrieval of any cost figure from a provider's API. A subscription amount is entered by the operator.
- No backfill of `agentRunSeconds`. Twelve of the sixteen existing records carry zero and take no share.
- No first real record in this change: recording what a plan cost is an operator's entry, made with the
  command this change adds, not a task of the change.
