# telemetry-capture Specification Delta

## MODIFIED Requirements

### Requirement: Token figures may be summed from a harness transcript

The system SHALL be able to sum a session's token figures from a local transcript file the operator names:
a JSONL file whose records carry a `usage` object in the wire format of the model API. Records SHALL be
deduplicated by message identifier, keeping the last record for each identifier, so a streaming transcript
that repeats a message as it grows counts that message once at its final usage. Input tokens SHALL exclude
cache traffic, cached tokens SHALL be cache reads plus cache writes, and cost SHALL NOT be derived from any
price table. The figures SHALL be recorded as `reported` like any other harness figure, and a transcript
that is absent, unreadable, or carries no usage record SHALL leave the session recorded as missing figures
rather than as zeros. A transcript SHALL only fill figures the payload omits, and SHALL NOT override a
figure the harness stated. When the transcript supplied any figure, the record's `figuresSource` SHALL name
the transcript as the source; when the payload stated every figure, its own source SHALL stand.

#### Scenario: A repeated message is counted once

- GIVEN a transcript carrying three records for one message identifier whose output tokens grow across them
- WHEN the figures are summed
- THEN that message's tokens MUST be counted exactly once
- AND the count MUST be the last record's

#### Scenario: A transcript with no usage leaves the record missing figures

- GIVEN a transcript with no record carrying a `usage` object
- WHEN a session is recorded with that transcript
- THEN the session file MUST carry `figuresMissing`
- AND it MUST NOT report zero tokens as a measured figure

#### Scenario: A stated figure wins over the transcript

- GIVEN a payload stating its own input and output tokens and a transcript with different totals
- WHEN the session is recorded
- THEN the stated figures MUST be written unchanged
- AND the payload's `figuresSource` MUST be written unchanged

#### Scenario: A source written before the sum does not survive it

- GIVEN a payload omitting its token figures whose `figuresSource` says the harness exposed none
- WHEN the session is recorded with a transcript carrying usage
- THEN the record's `figuresSource` MUST name the transcript and the number of messages summed
