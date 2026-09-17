# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: Token figures may be summed from a harness transcript

The system SHALL be able to sum a session's token figures from a local transcript file the operator names:
a JSONL file whose records carry a `usage` object in the wire format of the model API. Records SHALL be
deduplicated by message identifier, so a streaming transcript that repeats a message counts it once. Input
tokens SHALL exclude cache traffic, cached tokens SHALL be cache reads plus cache writes, and cost SHALL
NOT be derived from any price table. The figures SHALL be recorded as `reported` like any other harness
figure, and a transcript that is absent, unreadable, or carries no usage record SHALL leave the session
recorded as missing figures rather than as zeros. A transcript SHALL only fill figures the payload omits,
and SHALL NOT override a figure the harness stated.

#### Scenario: A repeated message is counted once

- GIVEN a transcript carrying three records for one message identifier, each with that message's usage
- WHEN the figures are summed
- THEN that message's tokens MUST be counted exactly once

#### Scenario: A transcript with no usage leaves the record missing figures

- GIVEN a transcript with no record carrying a `usage` object
- WHEN a session is recorded with that transcript
- THEN the session file MUST carry `figuresMissing`
- AND it MUST NOT report zero tokens as a measured figure

#### Scenario: A stated figure wins over the transcript

- GIVEN a payload stating its own input and output tokens and a transcript with different totals
- WHEN the session is recorded
- THEN the stated figures MUST be written unchanged

## MODIFIED Requirements

### Requirement: Capture needs no credential and no network

Recording a session, writing trailers, and validating either SHALL NOT require any credential for a hosting
platform or a model provider, and SHALL NOT contact any network service. No token, cost, or effort figure
SHALL be retrieved from a model provider's API; every such figure is reported by the harness and recorded
as reported. Summing figures from a local transcript file the operator names is a local file read and SHALL
be permitted; no other content of that file SHALL enter a session record.

#### Scenario: Recording a session needs no credential

- GIVEN a working copy with no platform or provider credential configured
- WHEN the session hook runs at the end of an agent session
- THEN it MUST write the session file without contacting any service

#### Scenario: No provider API is called for figures

- GIVEN a session hook invoked with no token figures from the harness
- WHEN it runs
- THEN it MUST record the session as missing figures
- AND it MUST NOT contact any model provider

#### Scenario: A transcript read carries nothing but figures

- GIVEN a transcript containing prompt text, tool output, and file contents alongside usage records
- WHEN figures are summed from it
- THEN only token counts MUST enter the session record
