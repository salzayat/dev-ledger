# Fix Transcript Token Window

## Why

Token figures summed from a transcript counted every record in the file. A harness that keeps one
transcript across a long conversation therefore charged each session every token of the conversation so
far: the record for `add-capture-install` reported about a million output tokens for a session that
produced about two thousand. Operator hours were windowed to the session in
`refine-hours-and-unit-economics`; the token sum was not.

## What Changes

- The token sum counts only records timestamped inside the session's window when a window is given, and
  `session end --transcript` passes the session's start and end. A record with no timestamp is left out.
- `session figures --transcript` accepts `--from` and `--to`.
- A dated note on The Ledger says the records written before this fix carry whole-transcript token counts.
  Allocated spend is unaffected; it is apportioned by agent run seconds.

## Non-Goals

- No rewrite of existing records.
