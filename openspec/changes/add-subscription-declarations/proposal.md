# Add Subscription Declarations

## Why

A subscription cost record is written by hand, one per plan per billing period
(`packages/capture/src/subscription.ts`). For one person on one plan that is twelve small files a year and
the repetition is invisible. For a team of eight across three plans it is thirty-six files a year, each
repeating an amount that almost never changes, and a rate change is silent: nothing notices when the amount
for next month is copied from last month after the price moved.

The record also conflates two different kinds of fact. `.telemetry/subscriptions/<period>/<plan>.json` is
both "what this plan costs" — a standing arrangement that changes rarely and on a date — and "what we paid
in September" — a fact about one month. Holding them in one file means the standing arrangement has no
history: what a plan cost in March is recoverable only by reading March's file, and a seat count that
changed mid-year is visible nowhere.

Nothing reports a gap, either. A period with no record for a declared plan reads as `noPeriodRecord`
exclusions scattered across the allocation, and a session naming a `subscriptionId` no record covers is
counted but never named against the plan it expected.

## What Changes

- Add a committed plan declaration holding, per plan, a provider, a currency, and effective-dated intervals
  carrying the unit amount and the seat count. A rate change or a seat change appends an interval; it never
  rewrites one, so what a plan cost in any month stays readable.
- Derive a period's expected amount as seats times unit for the interval covering that period, so an amount
  is checkable arithmetic rather than a bare number.
- Add `telemetry subscription close <period>`, which writes one period record per declared plan from the
  declarations for an operator to review and commit. Records stay committed facts; declarations are only
  how the command knows what to propose.
- Report configuration gaps on The Board, as a read: declared plans with no record for a closed period,
  records for plans no declaration covers, sessions naming a `subscriptionId` no record covers, and
  intervals that leave a period uncovered. Each gap names the command that closes it.

## Dependencies

None. `add-subscription-spend` (archived) supplies the record this declares against, and no active change is
required first.

## Non-Goals

- No generated record without a commit. `subscription close` proposes; an operator reviews and commits. A
  declaration is an intention and a record is what happened, and nothing derives a month's figures from an
  intention alone.
- No editing from the published dashboard. The Board "SHALL read only from the projection"
  (`openspec/specs/flow-observability/spec.md:410`) and its page carries "no script element and no external
  resource" (`:413`), so it reports configuration and names the commands rather than changing anything. A
  local editing surface would be a different program and needs its own change.
- No price table and no provider API call. A unit amount is entered by the operator, as the record's amount
  already is.
- No change to the allocation basis, which stays agent run seconds, or to how a period's amount is
  apportioned.
- No binding of a session to a plan beyond the `subscriptionId` it already carries; see the open question in
  `design.md`.
