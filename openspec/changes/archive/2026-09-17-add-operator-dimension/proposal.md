# Add Operator Dimension

## Why

The session record is symmetric about who did the work: `agentRunSeconds` and `operatorActiveSeconds` sit
beside each other in one record. The accepted contract admits only the first to a read. Provider and model
are dimensions of the flow signals and of The Ledger; `No read SHALL be keyed to a person` and `The Ledger
SHALL NOT present any figure keyed to an operator identifier` exclude the human. So agent labour is
observable and the human labour it substitutes for is not, and measuring the substitution is a question
this repository was built to answer.

This half was drafted inside `add-subscription-and-operator-spend` and split out when that change was
narrowed to subscription spend, because it reverses an accepted requirement, the README's "never
aggregates by person", the methodology's "Nothing keyed to a person", and the published position that the
tool will not rank anyone. It waits for the repository owner's decision. It is not started.

## What Changes

- Admit the operator as a dimension of the flow signals and of The Ledger, covering agent operators
  (provider and model) and human operators (the pseudonymous `operatorId`) alike.
- Report human effort in hours from `operatorActiveSeconds` and agent effort in currency and tokens, side
  by side, never summed into one figure and never priced.
- Exclude a change whose commits carry `Session: none`, and a session recorded before operator capture was
  enabled, from the human-hours figure with their counts stated, never as zero hours.
- Enable `costAllocation` in `telemetry.config.json` so records begin carrying `operatorId` and
  `operatorActiveSeconds`.
- Replace the accepted prohibition on operator-keyed figures with one on resolving an identifier to a
  person, and rewrite the methodology's "Nothing keyed to a person".

## Dependencies

`add-subscription-spend`, for the currency figure the agent side of the dimension reports.

`add-flow-efficiency-and-work-mix` (active, `Pending`), which modifies `Flow signals per repository and in
aggregate` as this change does; whichever archives second is rebased onto the first.

## Non-Goals

- No edit to the phase two proposal here: its non-goals carry the same prohibition and are reconciled by
  whoever implements it, after this decision.
- No hourly rate, salary, or currency figure for a human operator; the forbidden keys stay forbidden.
- No name or email address in any record, and no resolution of a pseudonymous `operatorId` to a person.
- No conversion of human hours into money anywhere in the projection or on The Ledger.
- No backfill: the existing records carry no `operatorId` and none is invented for them.
