# Add Provider Neutral Spend

## Why

Multi-provider work is already most of the way there and stops short in three specific places.

Provider and model are free-form data fields by accepted requirement
(`openspec/specs/telemetry-capture/spec.md:214`), and no provider name is hardcoded anywhere in
`packages/*/src`. The spend reads split by provider and by model, the operator dimension keys on the pair,
and the allocation keys on `period/subscriptionId` (`packages/flow/src/signals.ts:582`), so two plans from
two providers in one month never mix. A metered provider records a reported `costUsd`; a subscription
provider records a plan. Nothing needs undoing.

What is missing is narrower and concrete:

- **The rate covers only allocated spend.** `add-allocated-token-rate` divides an apportioned subscription
  amount by tokens. A metered provider reports its cost directly, so its rate needs no apportioning and is
  the stronger figure of the two, and it is not computed.
- **`costUsd` names a currency in its field.** The allocation is already multi-currency; the reported cost
  is not, so a provider billing in anything else has no correct home.
- **`cachedTokens` is one number defined as cache reads plus cache writes**
  (`openspec/specs/telemetry-capture/spec.md:249`), which is one provider's shape. A provider reporting only
  cache hits, with no separate write figure, is recorded as though its writes were zero, and the cache rate
  this repository now publishes is therefore not comparable across providers.

## What Changes

- Compute a metered rate: reported cost divided by the input and output tokens of the metered sessions,
  per provider and per currency, carrying trust class `reported` rather than `allocated`.
- Report the reported cost in a named currency rather than in a field called `costUsd`, keeping the existing
  field readable so committed records stay valid.
- Split cached tokens into reads and writes, so a provider that reports only reads is recorded as having
  reported only reads rather than as having written none, and state on every cache figure which components
  it covers.
- Render rates per provider and never combine denominators across providers, since the token counts they
  report are not the same measurement.

## Dependencies

`add-allocated-token-rate` (active), whose rate this sits beside and whose denominator rule it follows. It
is on the default branch now, so it is named here rather than only in the design. Both touch the same
figures, so whichever archives second is rebased onto the first.

## Non-Goals

- No price table, no notional cost, and no provider API call. A metered cost is reported by the harness, as
  it is today.
- No provider name in source. Provider stays data, and this change adds no branch keyed to a particular
  provider's identifier.
- No migration of committed records. Existing records keep `costUsd` and a single `cachedTokens`, and are
  read as reporting what they reported.
- No combined cross-provider cache rate, which the split exists to prevent rather than enable.
