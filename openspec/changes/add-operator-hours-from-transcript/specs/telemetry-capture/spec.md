# telemetry-capture Specification Delta

## MODIFIED Requirements

### Requirement: Harness session records travel in the work branch

A session hook SHALL write one file per agent or human work session at
`.telemetry/sessions/<yyyy-mm>/<session-id>.json` carrying the schema version, the provider, the model, input
tokens, output tokens, cached tokens, cost in USD, the source label of the figures, the session start and
end times, wall-clock seconds, agent run seconds (time the agent was executing), the branch, the commits the
session produced, the spec reference, the billing kind (`metered` or `subscription`), the subscription
identifier when the kind is `subscription`, and the outcome of the repository's local check command when the
session ran it (`passed`, `failed`, or `not-run`, with the command name). A session with billing kind
`subscription` SHALL record a cost of zero; a pay-per-token equivalent the harness displays MAY be recorded
only in a separate `notionalCostUsd` field, which no cost total reads. A session file MAY carry its own
`costClass` from the configured vocabulary. Only when cost allocation is enabled SHALL the file carry the
operator active seconds (computed by the configured idle-capped algorithm and recorded with that
algorithm's identifier) and the operator's pseudonymous identifier, read from the local git configuration
value `telemetry.operator` and validated against the identifiers declared in the configuration; a missing
or undeclared identifier SHALL be recorded as missing rather than guessed. A record carrying neither
operator figure SHALL be valid: the absence SHALL be counted by every read that needs the figure, in the
same way a record carrying `figuresMissing` is counted, and SHALL NOT make the record invalid or be read
as an operator who worked no time. A figure that is present and malformed SHALL still be rejected. The file SHALL NOT carry the
operator's name, email address, or any compensation figure. At session end the harness hook SHALL commit the
session file as its own commit on the current branch, and a `pre-push` hook SHALL refuse a push while a
finished session file is uncommitted; both hooks can be skipped, and a skipped hook surfaces as a paper-trail
gap. Token counts SHALL be non-negative integers and cost a non-negative number; the `pre-commit` hook and
`telemetry validate` SHALL reject a session file that violates the schema. The repository SHALL mark the
sessions path `linguist-generated`. A session file on the default branch SHALL NOT be edited or removed; a
correction SHALL be a further session file referencing the one it corrects.

#### Scenario: A session file arrives with the merge

- GIVEN a work branch containing a session file
- WHEN it is merged by squash, merge commit, or rebase
- THEN the session file MUST be present in the default branch's tree at the change's last commit
- AND the projection MUST attribute its figures to that change

#### Scenario: A malformed session file fails validation

- GIVEN a session file with a negative input token count
- WHEN `telemetry validate` or the `pre-commit` hook runs
- THEN it MUST fail and name the field

#### Scenario: The session hook commits its own file

- GIVEN an agent session that made two commits on a branch
- WHEN the session ends
- THEN the hook MUST commit the session file as a separate commit on that branch

#### Scenario: A subscription session carries no metered cost

- GIVEN a subscription session for which the harness displays a pay-per-token equivalent of 3.10
- WHEN the session file is written
- THEN its cost MUST be zero
- AND 3.10 MAY appear only as `notionalCostUsd`

#### Scenario: The local check outcome is recorded

- GIVEN a session during which the harness ran the repository's check command and it failed
- WHEN the session file is written
- THEN it MUST record the check outcome as `failed` with the command name

#### Scenario: Operator active time excludes idle gaps

- GIVEN cost allocation enabled with an idle cap of 15 minutes and a session whose operator events are
  separated by gaps of 2 minutes, 3 minutes, and 50 minutes
- WHEN the session file is written
- THEN the operator active seconds MUST count the 2 and 3 minute gaps and cap the 50 minute gap at the idle
  cap
- AND the file MUST name the algorithm identifier used

#### Scenario: Operator time is not recorded when cost allocation is off

- GIVEN a configuration with cost allocation disabled
- WHEN the session file is written
- THEN it MUST NOT carry operator active seconds or an operator identifier

#### Scenario: A session file carries no personal identity

- GIVEN cost allocation enabled and `telemetry.operator` set locally to a declared pseudonymous identifier
- WHEN the session file is written
- THEN it MUST carry that identifier
- AND it MUST NOT carry the operator's name, email address, or compensation

#### Scenario: A correction is a further file

- GIVEN a session file on the default branch recorded in error
- WHEN a correction is made
- THEN a correcting session file MUST be added referencing the original
- AND the original MUST remain readable

#### Scenario: A record with no operator figures is valid and counted

- GIVEN cost allocation enabled and a session record carrying neither operator active seconds nor an
  operator identifier
- WHEN the record is validated
- THEN validation MUST pass
- AND every read needing the figure MUST count that record as excluded rather than as zero time

#### Scenario: A malformed operator figure is still rejected

- GIVEN cost allocation enabled and a session record whose operator active seconds are negative
- WHEN the record is validated
- THEN validation MUST fail naming the field

### Requirement: Token figures may be summed from a harness transcript

The system SHALL be able to sum a session's token figures, and to derive the operator's active seconds,
from a local transcript file the operator names:
a JSONL file whose records carry a `usage` object in the wire format of the model API. Records SHALL be
deduplicated by message identifier, keeping the last record for each identifier, so a streaming transcript
that repeats a message as it grows counts that message once at its final usage. Input tokens SHALL exclude
cache traffic, cached tokens SHALL be cache reads plus cache writes, and cost SHALL NOT be derived from any
price table. The figures SHALL be recorded as `reported` like any other harness figure, and a transcript
that is absent, unreadable, or carries no usage record SHALL leave the session recorded as missing figures
rather than as zeros. Operator active seconds SHALL be derived from the operator's own prompts in that
transcript: a record addressed from the user whose content is a string, or whose content blocks are all
text. A record carrying a tool result is harness traffic and SHALL NOT count as an operator event, so an
unattended agent turn SHALL NOT read as operator presence. The gaps between consecutive prompts SHALL be
summed under the configured idle cap and recorded with the algorithm's identifier. A transcript with
fewer than two prompts SHALL leave the figure absent rather than recording zero. Nothing but timestamps
SHALL be read for this figure. A transcript SHALL only fill figures the payload omits, and SHALL NOT override a
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

#### Scenario: Tool results are not operator events

- GIVEN a transcript of 279 user-addressed records of which 262 carry a tool result and 17 are prompts
- WHEN operator active seconds are derived
- THEN only the 17 prompts MUST contribute events
- AND an unattended agent turn between two prompts MUST contribute no more than the idle cap

#### Scenario: A transcript with one prompt records no operator time

- GIVEN a transcript carrying exactly one operator prompt
- WHEN operator active seconds are derived
- THEN the figure MUST be absent rather than recorded as zero

#### Scenario: Operator hours read nothing but timestamps

- GIVEN a transcript containing prompt text, tool output, and file contents
- WHEN operator active seconds are derived
- THEN only timestamps MUST be read
- AND no transcript content MUST enter the session record
