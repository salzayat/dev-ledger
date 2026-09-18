# Tasks: Add Operator Dimension

## 1. Decision

- [x] 1.1 The repository owner accepts that a pseudonymous operator becomes a Ledger dimension, reversing the
      accepted prohibition, the README's "never aggregates by person", the methodology's "Nothing keyed to
      a person", and the published position. Record the decision here before starting any task below.
      **Decision, recorded:** the repository owner directed this explicitly — "the idea is to track agents
      and live engineers the same way" — and reaffirmed it when commissioning and then implementing this
      work. Agents and humans become peer dimensions; pseudonymity and the no-rate guard carry the
      privacy boundary instead of withholding the measurement.

## 2. The operator dimension

- [x] 2.1 `packages/flow/src/signals.ts`: the operator dimension, covering agent operators (provider and
      model) and human operators (`operatorId`).
- [x] 2.2 Human effort in hours from `operatorActiveSeconds`, in a figure separate from any currency
      amount; agent effort in currency from the subscription allocation and in tokens where reported.
- [x] 2.3 Exclude changes carrying `Session: none` and sessions predating `costAllocation` from the
      human-hours figure with their counts stated.

## 3. The Ledger

- [x] 3.1 An operator panel with human hours and agent currency side by side, no summed total across the
      two units, each human operator identified by its pseudonymous identifier alone; terminal render to
      match.

## 4. Configuration and documentation

- [x] 4.1 Set `costAllocation.enabled` to `true` in `telemetry.config.json` and declare the operators.
- [x] 4.2 Rewrite `docs/methodology.md` "Nothing keyed to a person" and the README's "never aggregates by
      person" to the new boundary: nothing resolved to a person.
- [x] 4.3 Reconcile `add-change-audit`'s non-goals with the accepted dimension.

## 5. Verification

- [x] 5.1 Test that no read and no rendered page multiplies `operatorActiveSeconds` by any rate, and that a
      record carrying `hourlyRate`, `rate`, `salary`, or `compensation` is still rejected.
- [x] 5.2 Test that changes carrying `Session: none` are excluded from human hours with their count stated.
- [x] 5.3 Test that no name or email address appears on the rendered page and that each human operator is
      identified by its pseudonymous identifier alone.
- [x] 5.4 `npm run check`, and `board --html` end to end, recording the result in the pull request.
