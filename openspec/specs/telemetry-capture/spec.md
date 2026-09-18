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
or undeclared identifier SHALL be recorded as missing rather than guessed. The file SHALL NOT carry the
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

### Requirement: Spec, session, change, and effort trailers on every commit

The repository SHALL define `Spec:` (an OpenSpec change name or a configured identifier pattern),
`Session:` (the active session identifier, or `none` when no harness session is active), `Change:` (an
identifier generated once per branch and kept in the local git configuration, so commits from one branch
group into one change after a rebase), effort trailers from the configured vocabulary, and, when cost
allocation is enabled, `Cost-Class:` from the configured cost-class vocabulary. The `prepare-commit-msg`
hook SHALL write them on each commit from values `scripts/pr.sh` stores in the branch's local git
configuration. The `commit-msg` hook SHALL validate the trailers against the configuration and SHALL reject
a subject over 100 characters, since a squash or merge commit subject is what the projection reads first.
`scripts/pr.sh` SHALL write the distinct `Spec:` and `Session:` values at the end of the pull request
description, so the recommended "title and description" merge message setting carries them onto a squash or
merge commit. A disabled effort unit SHALL be rejected by the `commit-msg` hook rather than ignored.

#### Scenario: The commit hook writes the trailers

- GIVEN a branch whose local git configuration names a spec, a session, and a change identifier
- WHEN a commit is made through the hooks
- THEN its message MUST end with `Spec:`, `Session:`, and `Change:` trailers carrying those values

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
