# Design: Add Operator Hours From Transcript

## A human prompt is an operator event; a tool result is not

The transcript's `type: "user"` records are not all the human. In a representative session of 1,453
records, 279 are `type: "user"` and 262 of those carry a `tool_result` content block — the harness returning
its own tool output to the model, written at machine speed through the middle of a long agent turn. Seventeen
are the human: content that is a plain string, or blocks that are all `text`.

The discrimination is therefore on content shape rather than on `type` or `userType`, both of which read
`user` and `external` for every one of them. Counting by `type` alone would turn a single unattended
twenty-minute agent run into a dense sequence of "operator events" and report the engineer as continuously
present, which is the opposite of what the figure is for.

## The cap is what makes it a measure of engagement rather than of elapsed time

`computeOperatorActiveSeconds` (`packages/capture/src/session.ts:57-71`) sums the gaps between consecutive
events and caps each at the configured idle cap, so a gap longer than the cap contributes the cap and not
the gap. Applied to the transcript above, seventeen prompts spanning 1.37 hours yield 1.28 hours: the
difference is the operator stepping away while the agent worked.

This is why the figure is derived from prompts rather than from the session's wall clock, which
`wallClockSeconds` already records. Wall clock says how long the session lasted; operator active seconds say
how much of it a human was in.

## Absence is counted, not rejected

The validation rule this change relaxes is the only place in the repository where a missing figure makes a
record invalid. Everywhere else — `figuresMissing` for tokens
(`openspec/specs/flow-observability/spec.md:125-134`), a change lacking an effort unit, a session with no
agent seconds — the rule is the same: exclude it, count it, never read it as zero and never fail.

Making operator figures fatal was a side effect of enabling the configuration flag, not a considered
position, and it is the wrong one for a repository whose own records predate the feature. A record written
by a harness that cannot supply the figure is not a malformed record; it is a record of work whose operator
time is unknown. The projection already handles that case correctly
(`packages/flow/src/signals.ts`, which counts `noOperator` and excludes), so only the validator needed to
agree with it.

## The figure travels the path the token figures already cut

`add-session-figures-from-transcript` established the shape: `session figures --transcript` reads a local
file the operator names, prints a JSON fragment, and `session end` merges it into the payload. Operator
seconds join that fragment rather than getting a path of their own, so there is one transcript read, one
place that knows the file format, and one command in the documented loop.

Only timestamps leave the transcript. No prompt text, no tool output, and no file content enters a session
record, which `A transcript read carries nothing but figures`
(`openspec/specs/telemetry-capture/spec.md:198-204`) already requires and this change extends to the new
figure rather than weakening.
