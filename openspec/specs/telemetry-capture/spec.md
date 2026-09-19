# telemetry-capture Specification

## Purpose

Record what a repository knows about its own work at the moment the work happens, using only git hooks
and the harness that ran the session: one session file per work session that travels with the pull
request, trailers on every commit, and a configuration read as it stood at each change. No platform API,
token, or network is involved, and every record says whether git observed it or the harness reported it.

## Requirements

### Requirement: Records declare producer and trust class

Every capture record SHALL declare its producer (`harness`, `git`, or `operator`) and its trust class. A
record written by a session hook SHALL be `reported`. A fact read from commit history SHALL be `observed`.
A subscription cost record SHALL be `reported` with producer `operator`. A figure computed by apportioning
an operator-entered amount across records SHALL be `allocated`, and SHALL name the basis it was apportioned
by. A read over the projection SHALL state which trust classes it included, and no read SHALL promote a
`reported` record to `observed`, or an `allocated` figure to either.

#### Scenario: A session record is reported

- GIVEN a session file written by a harness hook
- WHEN the projection is rebuilt
- THEN its token and cost figures MUST carry producer `harness` and trust class `reported`

#### Scenario: A merge time is observed

- GIVEN a merge commit on the default branch
- WHEN the projection is rebuilt
- THEN its committer date MUST carry producer `git` and trust class `observed`

#### Scenario: An apportioned subscription amount is allocated

- GIVEN a subscription cost record for a period and three sessions ending in that period
- WHEN each session's share of the period amount is computed
- THEN each share MUST carry trust class `allocated`
- AND it MUST name the basis it was apportioned by
- AND no read MUST present it as `reported`

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

### Requirement: Spec, session, change, and effort trailers on every commit

The repository SHALL define `Spec:` (an OpenSpec change name or a configured identifier pattern),
`Session:` (the active session identifier, or `none` declaring that the work carried no agent session),
`Change:` (an identifier generated once per branch and kept in the local git configuration, so commits from
one branch group into one change after a rebase), effort trailers from the configured vocabulary, and, when
cost allocation is enabled, `Cost-Class:` from the configured cost-class vocabulary. `none` SHALL be written
only from a declaration an operator has made for the branch, and SHALL NOT be written because no session is
active: when no session is active and no such declaration has been made, the `prepare-commit-msg` hook SHALL
write no `Session:` trailer, so the change is classified `undeclared` rather than declared human-only. The
`prepare-commit-msg` hook SHALL write the trailers on each commit from values `scripts/pr.sh` stores in the
branch's local git configuration. The `commit-msg` hook SHALL validate the trailers against the
configuration, SHALL accept a message carrying no `Session:` trailer, and SHALL reject a subject over 100
characters, since a squash or merge commit subject is what the projection reads first. `scripts/pr.sh` SHALL
write the distinct `Spec:` and `Session:` values at the end of the pull request description, so the
recommended "title and description" merge message setting carries them onto a squash or merge commit. A
disabled effort unit SHALL be rejected by the `commit-msg` hook rather than ignored.

#### Scenario: The commit hook writes the trailers

- GIVEN a branch whose local git configuration names a spec, a session, and a change identifier
- WHEN a commit is made through the hooks
- THEN its message MUST end with `Spec:`, `Session:`, and `Change:` trailers carrying those values

#### Scenario: No active session writes no session trailer

- GIVEN a branch with no active session and no human-only declaration
- WHEN a commit is made through the hooks
- THEN its message MUST carry no `Session:` trailer
- AND the projection MUST classify its change `undeclared`

#### Scenario: A commit after a session ends is undeclared, not human-only

- GIVEN a branch on which `telemetry session end` has recorded a session and unset the active session
- WHEN a further commit is made on that branch through the hooks
- THEN its message MUST carry no `Session:` trailer
- AND it MUST NOT be recorded as declared human-only work

#### Scenario: Human-only work is declared deliberately

- GIVEN a branch for which an operator has declared that the work carries no agent session
- WHEN a commit is made through the hooks
- THEN its message MUST carry `Session: none`
- AND the projection MUST classify its change neither `undeclared` nor `unreported`

#### Scenario: An over-long subject is rejected

- GIVEN a commit whose subject exceeds 100 characters
- WHEN the `commit-msg` hook runs
- THEN it MUST fail and name the length

#### Scenario: A disabled effort unit is rejected

- GIVEN a configuration in which story points are disabled
- WHEN a commit message carries a `Story-Points:` trailer
- THEN the `commit-msg` hook MUST fail and name the disabled unit

#### Scenario: PR creation writes the spec reference

- GIVEN an operator creates a pull request through `scripts/pr.sh` on a branch whose change name is known
- WHEN the pull request is created
- THEN its description MUST end with a `Spec:` trailer naming that change

### Requirement: Configured effort vocabulary

The repository SHALL carry a version-controlled telemetry configuration (`telemetry.config.json`) declaring
which effort units are enabled and, for a reported unit, its accepted values. The vocabulary SHALL cover
reported effort (`Story-Points:`, a non-negative integer or a value from a configured scale, and
`Work-Hours:`, a non-negative number) and measured effort (agent wall-clock seconds from the session record),
and MAY offer a derived complexity figure computed from the change's diff. Derived complexity SHALL be
disabled by default and, when enabled, SHALL record the identifier of the algorithm that produced it. The
projection SHALL read the configuration as it stood at each change's parent commit, so a later
configuration change does not restate past changes.

#### Scenario: Reported, measured, and derived effort are distinguishable

- GIVEN a change with a `Story-Points:` trailer, a session wall-clock figure, and no work hours
- WHEN the projection is rebuilt
- THEN story points MUST read as reported, wall-clock as measured, and work hours as absent, not zero

#### Scenario: A configuration change does not restate past changes

- GIVEN a change recorded while a unit was enabled and a later commit disabling that unit
- WHEN the projection is rebuilt at the branch tip
- THEN the earlier change MUST retain the unit it recorded

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

### Requirement: Provider and model identifiers are data in capture records

Session files and the projection SHALL carry the provider and model identifiers the harness reports, as
data fields, so cost can be attributed by provider and by model. This is the only place a provider or model
name appears in repository-produced content; documentation, commit messages, and prose stay neutral.

#### Scenario: A provider identifier is a field, not prose

- GIVEN a session file naming a provider and a model
- WHEN the projection is rebuilt
- THEN the provider and model MUST appear as data fields on the session record
- AND no generated document MUST add a provider name outside those fields

### Requirement: Git children never inherit the caller's index or repository

Every git child process this repository's packages run SHALL be given an environment with the inherited git
variables removed — `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_WORK_TREE`, `GIT_OBJECT_DIRECTORY`,
`GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_PREFIX`, and `GIT_COMMON_DIR` — so a command acts on the
repository it was given and never on the caller's. A command invoked from a git hook, where those variables
are exported, SHALL behave exactly as it does when invoked from a shell.

#### Scenario: A command invoked from a hook acts on its own repository

- GIVEN `GIT_INDEX_FILE` and `GIT_DIR` are exported and name another repository
- WHEN a capture command runs against a working copy
- THEN it MUST read and write that working copy's own repository
- AND it MUST NOT add an entry to the exported index

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

### Requirement: Subscription cost records are period facts

The system SHALL record what a subscription plan cost as a record of its billing period, not as a field of
any session record. A subscription cost record SHALL declare its schema version, the plan identifier
(matching the `subscriptionId` of the sessions it covers), the period it covers as `YYYY-MM`, the amount
billed for that period, the currency as a three-letter code, and the amount paid in overage beyond the plan,
and SHALL be committed under `.telemetry/subscriptions/<period>/<plan>.json`. The amount SHALL be entered
by the operator through `telemetry subscription record` and SHALL NOT be retrieved from any provider or
platform API. A subscription cost record SHALL reject the same forbidden keys a session record rejects, so
no rate, salary, or compensation figure can enter it. `costUsd` on a subscription session record SHALL
remain zero. `telemetry validate` SHALL validate subscription cost records alongside session records.

#### Scenario: A subscription cost record is written without a network call

- GIVEN a working copy with no platform or provider credential configured
- WHEN an operator records a subscription cost for a period
- THEN the record MUST be written and committed without contacting any service

#### Scenario: A rate cannot enter a subscription cost record

- GIVEN a subscription cost record carrying an `hourlyRate` field
- WHEN it is validated
- THEN validation MUST fail naming the forbidden key

#### Scenario: A subscription session still records no marginal cost

- GIVEN a subscription cost record for a period and a session ending in that period
- WHEN the session record is validated
- THEN its `costUsd` MUST still be required to be zero

### Requirement: Plan declarations carry effective-dated amounts

The system SHALL keep a committed plan declaration listing each subscription plan with its identifier, its
provider, its currency, and effective-dated intervals each carrying a unit amount and a seat count. An
interval SHALL state the period from which it holds; intervals for one plan SHALL be ordered and SHALL NOT
overlap, and a change in price or seat count SHALL be expressed by appending an interval rather than by
editing one, so what a plan cost in any period stays readable. A period covered by no interval SHALL be
reported as uncovered and SHALL NOT resolve to the nearest interval. A declaration SHALL reject the same
forbidden keys a session record rejects, so no rate, name, or address can enter it, and SHALL require no
credential and no network.

#### Scenario: A rate change appends an interval

- GIVEN a plan declared at 100 per seat from 2026-01 and at 120 per seat from 2026-07
- WHEN the amount for 2026-06 and for 2026-08 is resolved
- THEN 2026-06 MUST resolve to 100 per seat
- AND 2026-08 MUST resolve to 120 per seat

#### Scenario: Overlapping intervals are rejected

- GIVEN a plan whose intervals both claim to hold from 2026-03
- WHEN the declaration is validated
- THEN validation MUST fail naming the plan and the period

#### Scenario: An uncovered period is named, not guessed

- GIVEN a plan whose earliest interval holds from 2026-06 and a session ending in 2026-03
- WHEN the amount for 2026-03 is resolved
- THEN it MUST be reported as uncovered
- AND it MUST NOT resolve to the 2026-06 interval

### Requirement: A period is closed into records an operator commits

The system SHALL provide a command that writes one subscription cost record per declared plan for a named
period, with the amount computed as the seat count times the unit amount of the interval covering that
period. The command SHALL NOT commit what it writes, so the committed record remains a fact an operator
confirmed rather than one a declaration asserted. It SHALL leave an existing record unchanged unless
overwriting is requested, and SHALL refuse to close a period whose end has not passed unless forced, so an
open month is not recorded as settled.

#### Scenario: Closing a period proposes records without committing

- GIVEN two declared plans and a closed period
- WHEN the period is closed
- THEN one record per plan MUST be written with the amount as seats times unit
- AND nothing MUST be committed

#### Scenario: An existing record is not silently replaced

- GIVEN a period already carrying a record for a declared plan
- WHEN the period is closed without overwriting requested
- THEN that record MUST be left unchanged
- AND the command MUST say what it would have changed

#### Scenario: An open period is not closed by accident

- GIVEN a period whose end has not passed
- WHEN the period is closed without forcing
- THEN the command MUST refuse and name the period

### Requirement: The session commands own the session's clock

`telemetry session start` SHALL record the time it was invoked alongside the session identifier, in the same
local git configuration. `telemetry session end` SHALL write `startedAt` from that recorded time and
`endedAt` from its own clock when the payload omits them, SHALL keep a payload's stated times when it states
them, and SHALL clear the recorded start with the identifier. A session file SHALL still carry both times.

#### Scenario: A payload without times gets the commands' clock

- GIVEN `session start` was run and a payload omitting `startedAt` and `endedAt`
- WHEN `session end` records the session
- THEN the file's `startedAt` MUST equal the time `session start` recorded
- AND its `endedAt` MUST be at or after it

#### Scenario: A payload's own times are kept

- GIVEN a payload stating `startedAt` and `endedAt`
- WHEN `session end` records the session
- THEN both MUST be written unchanged

### Requirement: A harness adapter runs the session lifecycle

The repository SHALL provide a hook adapter for at least one harness that runs `session start` when a
harness session begins and `session end --transcript` when it ends, deriving the model from the
transcript, the plan from the declarations, and the commits from the branch since the recorded start, and
naming the adapter in `figuresSource`. The adapter SHALL need nothing but git and this repository.

#### Scenario: A session ends without anyone remembering

- GIVEN the adapter wired into the harness and a session that made commits
- WHEN the harness session ends
- THEN a session record MUST be written and committed naming those commits
- AND the active session MUST be cleared

### Requirement: Recording a session is atomic and loud

When the record commit fails, `session end` SHALL remove the record it wrote, SHALL leave the session
active, and SHALL print the failing hook's output.

#### Scenario: A failed commit leaves nothing half done

- GIVEN a pre-commit hook that fails
- WHEN `session end` runs
- THEN no record file MUST remain
- AND the session MUST still be active
- AND the hook's message MUST be printed

### Requirement: Reported cost names its currency

A session record MAY carry its reported cost as an amount with a currency rather than in a field naming one.
A record carrying the historical `costUsd` SHALL be read as a cost in USD, so records committed before this
requirement stay valid and are never rewritten. A record carrying both an amount with a currency and
`costUsd` with different values SHALL be rejected. Every read over reported cost SHALL aggregate per
currency and SHALL NOT add amounts in different currencies.

#### Scenario: A historical record is read in USD

- GIVEN a session record carrying `costUsd` and no currency-named amount
- WHEN the projection is rebuilt
- THEN its cost MUST be read as that amount in USD

#### Scenario: Two currencies are never added

- GIVEN two metered sessions reporting costs in different currencies
- WHEN reported spend is requested
- THEN each currency MUST be reported separately
- AND no figure MUST add the two

### Requirement: Cache reads and cache writes are separate measurements

A session record MAY carry cache reads and cache writes as separate figures. A record carrying the
historical combined `cachedTokens` SHALL be read as a combined figure whose components are unknown, and any
read including it SHALL say so. A provider reporting only cache reads SHALL be recorded as having reported
only cache reads and SHALL NOT be recorded as having written zero. Every cache figure SHALL state which
components it covers, and no read SHALL combine a cache denominator across providers.

#### Scenario: Reporting only reads is not reporting zero writes

- GIVEN a harness that reports a cache hit count and no cache write count
- WHEN the session record is written
- THEN it MUST record the reads it reported
- AND it MUST NOT record a cache write count of zero

#### Scenario: A combined historical figure says it is combined

- GIVEN a session record carrying the historical `cachedTokens`
- WHEN a cache figure including it is rendered
- THEN the figure MUST state that the record's components are unknown

### Requirement: Operator hours are attributed within the session window

When a session's operator hours are read from a transcript, only the transcript events between the
session's recorded start and its end SHALL be attributed, so a transcript shared across sessions never
charges one session another's hours. A payload stating its own hours SHALL keep them. When cost allocation
is enabled and no operator identifier is configured, `session end` SHALL record the hours without an
identifier and SHALL print how to configure one.

#### Scenario: Events outside the window do not count

- GIVEN a transcript with prompts an hour apart before the session started and ten minutes apart inside it
- WHEN the session is recorded with that transcript
- THEN its operator hours MUST come from the ten minutes inside the window alone

#### Scenario: No identifier is a warning, not a lost measurement

- GIVEN cost allocation enabled and no `telemetry.operator` configured
- WHEN a session is recorded
- THEN the record MUST carry its hours with a null identifier
- AND the command MUST print the configuration command that sets one

### Requirement: A spec's cost class is declared once

An operator MAY declare a cost class per spec in a committed file under `.telemetry/`, written by
`telemetry class set <spec> <class>`, validated against the configured class vocabulary and spec pattern,
and rejecting the forbidden keys. `telemetry validate` SHALL cover it.

#### Scenario: A class outside the vocabulary is refused

- GIVEN a vocabulary of `rd` and `production`
- WHEN `class set add-x marketing` runs
- THEN it MUST fail naming the vocabulary

### Requirement: A period's hours are confirmed by a timesheet

`telemetry timesheet close <YYYY-MM>` SHALL propose one timesheet per declared operator from the session
records that ended in the period, carrying hours by spec as measured and the same figures as the confirmed
column to be edited, SHALL write them under `.telemetry/timesheets/<period>/` without committing, SHALL
refuse a period whose end has not passed without `--force`, and SHALL leave an existing sheet alone
without `--overwrite`. A timesheet SHALL name a declared operator, SHALL carry no rate and no name, and
SHALL be validated by `telemetry validate`.

#### Scenario: Close proposes and stops

- GIVEN two records in September for one operator, one citing a spec and one citing none
- WHEN `timesheet close 2026-09` runs
- THEN one sheet MUST be written with hours by spec and `(none)`, measured equal to confirmed
- AND nothing MUST be committed

### Requirement: Capture installs into any repository

The capture commands SHALL resolve the tool from their own location and act on the repository they run in.
`scripts/install-capture.sh <repository>` SHALL install capture there without changing that repository's
commit style or checks: hook shims for `prepare-commit-msg` and `pre-push` in its hooks directory, the
operator, plan, and provider in its local git configuration, a `telemetry.config.json` when it has none,
and optionally the harness adapter. An existing hook SHALL be kept, and run first when `--force` installs
over it. A repository whose hooks are routed with `core.hooksPath` SHALL be refused with the lines to add.

#### Scenario: A session is recorded in another repository

- GIVEN capture installed into a repository with an operator and a plan
- WHEN a session is started there, work is committed, and the session is ended
- THEN the work commit and the record commit MUST carry the `Session:` trailer
- AND the record MUST be committed in that repository carrying the operator

#### Scenario: A routed repository is refused

- GIVEN a repository with `core.hooksPath` set
- WHEN capture is installed
- THEN the installer MUST exit with an error and change nothing
