# Tasks: Add Subscription Declarations

## 1. The declaration

- [x] 1.1 Define the plan declaration in `packages/capture/src/`: `schemaVersion`, and per plan a `planId`,
      `provider`, `currency`, and `intervals` of `{ from, unit, seats }`, committed under
      `.telemetry/subscriptions/plans.json`.
- [x] 1.2 Validate it: a well-formed `from` period, non-negative `unit` and `seats`, intervals ordered and
      non-overlapping, and the same forbidden keys a session record rejects so no rate or name can enter.
- [x] 1.3 Resolve the interval covering a period, and report a period no interval covers as uncovered
      rather than defaulting to the nearest.

## 2. Closing a period

- [x] 2.1 Add `telemetry subscription close <period>`, writing one period record per declared plan with
      `amount` as seats times unit for the covering interval.
- [x] 2.2 Leave an existing record alone unless `--overwrite` is passed, and print what it would change.
- [x] 2.3 Do not commit: print the paths written and leave staging and committing to the operator.
- [x] 2.4 Refuse to close a period whose end has not passed unless `--force` is passed, so an open month is
      not recorded as settled by accident.

## 3. Configuration gaps as a read

- [x] 3.1 Collect gaps in the projection: a declared plan with no record for a closed period, a record no
      declaration covers, a session naming a `subscriptionId` no record covers, and an uncovered period.
- [x] 3.2 Render them as a Board panel, each gap naming the command that closes it, with the records cited.
- [x] 3.3 Match it in the terminal render.
- [x] 3.4 Keep the page self-contained: no script element, no external resource, no form.

## 4. Documentation

- [x] 4.1 Document the declaration, the close command, and the review-then-commit loop in `README.md` and
      `docs/contract.md`.
- [x] 4.2 State in `docs/methodology.md` why a declaration never becomes a figure without a commit.

## 5. Verification

- [x] 5.1 Test that a rate change appends an interval and that each period resolves to the interval that
      held, including the period the change lands in.
- [x] 5.2 Test that overlapping or unordered intervals are rejected.
- [x] 5.3 Test that `close` writes seats times unit, leaves an existing record alone without `--overwrite`,
      and commits nothing.
- [x] 5.4 Test that closing an open period without `--force` is refused.
- [x] 5.5 Test each gap kind appears on the Board with its command, and that a session naming an unknown
      plan is named rather than only counted.
- [x] 5.6 Test that the rendered page still carries no script element, no external resource, and no form.
- [ ] 5.7 Run `npm run check` and the board end to end, recording the result in the pull request.
