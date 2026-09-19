# telemetry-capture Specification Delta

## MODIFIED Requirements

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
unattended agent turn SHALL NOT read as operator presence. The span between consecutive prompts SHALL be attributed
rather than capped whole: the time up to the last agent record in that span is the agent working
autonomously, the remainder is the operator, and the part of that remainder beyond the configured idle cap
is the thread sitting idle. The three SHALL sum to the span between the first and last prompt, and SHALL be
recorded alongside each other with the algorithm's identifier, so a reader can check them. Attributing the
whole span to the operator instead would charge an unattended agent run to a person; over this repository's
own transcripts that reads about 1.75 times the man hours actually worked. A transcript with
fewer than two prompts SHALL leave the figure absent rather than recording zero. Nothing but timestamps
SHALL be read for this figure. Agent run seconds SHALL be derived from the same timestamps: each turn
runs from its prompt, or from the first record in the window for work already under way, to the last agent
record before the next prompt, the final turn included, and a gap between two records of one turn longer than
the idle cap SHALL count as the cap. One prompt, or none, SHALL suffice; a window with no agent record SHALL
leave the figure absent. Run seconds SHALL fill whether or not cost allocation is enabled. A transcript SHALL only fill figures the payload omits, and SHALL NOT override a
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

#### Scenario: A session opened mid-turn records its run

- GIVEN a session window holding no prompt and agent records spanning thirteen minutes
- WHEN the session is recorded with that transcript and no stated run seconds
- THEN `agentRunSeconds` MUST be thirteen minutes, not zero

#### Scenario: The final turn counts and a long wait is capped

- GIVEN a prompt, agent records one minute and fifty minutes after it, and an idle cap of ten minutes
- WHEN agent run seconds are derived
- THEN they MUST be eleven minutes

#### Scenario: A transcript with one prompt records no operator time

- GIVEN a transcript carrying exactly one operator prompt
- WHEN operator active seconds are derived
- THEN the figure MUST be absent rather than recorded as zero

#### Scenario: Operator hours read nothing but timestamps

- GIVEN a transcript containing prompt text, tool output, and file contents
- WHEN operator active seconds are derived
- THEN only timestamps MUST be read
- AND no transcript content MUST enter the session record

#### Scenario: An unattended agent run is not man hours

- GIVEN a span between two prompts in which the agent produced records for forty minutes and the operator
  replied five minutes after the last of them
- WHEN the span is attributed
- THEN forty minutes MUST be recorded as agent autonomous time
- AND five minutes MUST be recorded as operator time
- AND no part of the agent's forty minutes MUST be counted as man hours

#### Scenario: A thread left open is idle, not worked

- GIVEN a span of forty-five minutes between two prompts in which no agent record appears, under a fifteen
  minute idle cap
- WHEN the span is attributed
- THEN fifteen minutes MUST be recorded as operator time
- AND thirty minutes MUST be recorded as idle
