# Add Operator Hours From Transcript

## Why

Enabling `costAllocation` in `add-operator-dimension` made two operator fields mandatory on every session
record (`packages/capture/src/session.ts:189-200`), and nothing produces them.
`computeOperatorActiveSeconds` (`packages/capture/src/session.ts:57-71`) has existed since flow
observability and is called by no writer; `telemetry session end` takes them only if a payload already
carries them, and the harness hook supplies none.

The result is a regression that degrades quietly. `./scripts/telemetry.sh validate` now fails all nineteen
committed session records with `operatorActiveSeconds must be a non-negative number when cost allocation is
enabled`, and every record written from now on fails the same way. An invalid session is excluded from every
figure and counted (`packages/flow/src/signals.ts`), so the board loses figures rather than reporting an
error, and the human-hours dimension the previous change added stays permanently empty.

The figure also has no definition in this repository. `operatorActiveSeconds` is documented as the gap
between "the operator's own events" without saying what an operator event is. For an agentic harness the
answer is the operator's prompts in the message thread: the time a human spends directing the work. A
transcript already records them, and `telemetry session figures --transcript` already reads that file for
token counts (`packages/capture/src/figures.ts`), so the input is in hand and read locally.

Counting them naively would be badly wrong. In a representative transcript of 1,453 records, 279 carry
`type: "user"` and only 17 are human prompts — the other 262 are `tool_result` blocks, the harness feeding
its own tool output back to the model. Treating those as operator events would report an engineer as
present for every file read.

## What Changes

- Attribute the span between consecutive prompts three ways rather than capping it whole: agent autonomous
  time up to the last agent record, operator time after it under the idle cap, and idle beyond that. Record
  all three, so man hours exclude unattended agent runs and the figures sum to the span.
- Report man hours beside tokens as an expense in their own unit, per change and per unmerged pull request,
  so a pull request an operator was present for shows what that presence cost in time.
- Derive the prompts a span is measured between from a session transcript: a `type: "user"` record whose
  content is a string, or whose content blocks are all `text`. A record carrying a `tool_result` block is
  harness traffic and SHALL NOT count as an operator event.
- Emit `operatorActiveSeconds` and `operatorActiveAlgorithm` from
  `telemetry session figures --transcript`, so `session end` records them the same way it records tokens.
- Stop rejecting a record that lacks them. When cost allocation is enabled and a record carries no operator
  figures, the record SHALL be valid and its absence SHALL be counted, exactly as `figuresMissing` already
  works for tokens, rather than making the record invalid.
- Keep the idle cap and the recorded algorithm identifier, so a figure says how it was computed.

## Dependencies

`add-operator-dimension` (archived), which added the human-hours read this change fills, and enabled the
configuration that makes the fields mandatory.

## Non-Goals

- No cost figure for a human operator. Hours stay hours; `FORBIDDEN_SESSION_KEYS`
  (`packages/capture/src/session.ts:42`) keeps rejecting `hourlyRate`, `rate`, `salary`, and
  `compensation`, and no read multiplies hours by anything.
- No content from the transcript enters a session record. Only timestamps are read, as
  `Capture needs no credential and no network` (`openspec/specs/telemetry-capture/spec.md:177`) already
  requires of the token sum.
- No backfill of the nineteen existing records. They carry no transcript and none is invented.
- No change to how the projection reads hours; `packages/flow/src/signals.ts` already counts a session with
  no operator identifier as excluded.
