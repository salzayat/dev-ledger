# Design: Add Session Figures From Transcript

## Deduplicate by message identifier, or overcount by half

A streaming transcript writes a record each time a message grows, and each record carries that message's
cumulative `usage`. Summing rows therefore counts the same tokens many times. Measured on the transcript
this change was written against: 355 rows carry a `usage` object, but only 233 distinct message
identifiers. The reader keeps the first record it sees for a message identifier and ignores the rest, and a
record with no identifier is counted once on its own.

This is why the reader is code with a test rather than a `jq` line in a hook: the correction is not
obvious, and getting it wrong inflates every figure the repository reports.

## Three fields, and no fourth

`inputTokens` is the sum of `input_tokens`: the input actually processed. `cachedTokens` is
`cache_read_input_tokens` plus `cache_creation_input_tokens`, because both are cache traffic and the
session file has one field for it (`packages/capture/src/session.ts:17-20`). `outputTokens` is
`output_tokens`.

Cost is left alone. Deriving it needs a price per model per token class, which would mean a pricing table
in this repository keyed by provider and model — stale the day a price changes, and a figure nobody
measured presented beside figures that were. The contract already has the honest answers: `costUsd` is zero
on a subscription, and a metered harness reports what it was billed.

## The transcript fills gaps, and never overrides

`session end --transcript` applies the summed figures only to fields the payload omits. A harness that
knows its own figures keeps them; a harness that knows nothing gets them from its transcript; a payload
that states a figure is never rewritten by a file. The same rule keeps `figuresMissing` meaningful: it is
still `buildSessionFile` that decides, from whether the fields ended up present
(`packages/capture/src/session.ts:254-258`), so a transcript with no usage record leaves the session
recorded as missing figures rather than as zero.

## Nothing here is named after a harness

The reader is described by the shape it reads — a JSONL file whose records carry a `usage` object in the
wire format of the model API — and the path is given by the operator. The repository's neutral attribution
rule (`AGENTS.md`, Neutral Repository Attribution) means no command, file, or document here is named for a
vendor, and a harness-specific wrapper belongs in `.agent/` configuration, which is an adapter rather than
part of the contract.
