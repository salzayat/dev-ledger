# Add Session Figures From Transcript

## Why

Every session record in this repository carries `figuresMissing: true`, and every spend figure on The Board
reads `figures missing` as a result. That is the contract working — a record the harness gave no figures
for is counted, never zeroed (`openspec/specs/flow-observability/spec.md`, Requirement: Session
declarations, and missing records counted rather than zeroed) — but it means the repository has never once
reported what its own work cost.

The gap is not in the schema and not in the projection. `SessionInput` accepts `inputTokens`,
`outputTokens`, `cachedTokens`, and `costUsd` (`packages/capture/src/session.ts:220-228`), and
`buildSessionFile` marks a record as missing figures exactly when the first two are absent
(`packages/capture/src/session.ts:254-258`). Nothing in the repository _produces_ them, so every payload
written by hand omits them.

Harnesses do hold the figures: an agent session's transcript is a JSONL file whose assistant records carry
a `usage` object in the wire format of the model API — `input_tokens`, `output_tokens`,
`cache_read_input_tokens`, `cache_creation_input_tokens`. Reading it is a local file read, not a provider
call, so it stays inside "no token, cost, or effort figure SHALL be retrieved from a model provider's API"
(`openspec/specs/telemetry-capture/spec.md`, Requirement: Capture needs no credential and no network).

## What Changes

- `packages/capture/src/figures.ts`: sum a JSONL transcript's `usage` objects into token figures.
  Records are deduplicated by message identifier, because a streaming transcript repeats a message as it
  grows — in the transcript this change was written against, 355 usage rows carry only 233 distinct
  messages, so summing rows would overcount by half.
- `inputTokens` is the uncached input, `cachedTokens` is cache reads plus cache writes, and
  `outputTokens` is output. Cost is not derived: a price table would put provider pricing in this
  repository and would be wrong the day it changes.
- `session figures --transcript <file>` prints the figures as JSON. `session end --transcript <file>` fills
  in the figures a payload omits, so a harness hook can pass its transcript and stop hand-writing numbers.
- A transcript that is absent, unreadable, or carries no usage record produces no figures, and the record
  is written as missing figures exactly as before. Nothing is ever summed into a zero.

## Dependencies

`fix-capture-git-environment` (archived on this branch): the end-to-end test runs the capture command as a
child process from a fixture repository, which is only safe once a git child stops inheriting the caller's
index.

## Non-Goals

- No pricing table and no cost derivation. On a subscription the contract already requires `costUsd` to be
  zero; on a metered session the harness reports the cost it was billed.
- No provider API call, no credential, and no network. The transcript is a local file the operator names.
- No parsing of anything but a record's `usage` object: no prompt text, no tool output, no file content
  ever enters a session record.
- No transcript discovery. The path is passed in; this repository does not guess where a harness keeps its
  files, and nothing here is named after a harness.
- No correction of records already written. The existing records carry `figuresMissing` honestly, because
  nobody measured them.
