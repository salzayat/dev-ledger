# telemetry-capture Specification

Telemetry capture is what a repository records about its own work, at the moment the work happens, using
only git hooks and the harness that ran the session. A session file travels with the work in the pull
request; trailers travel on the commits. Nothing here needs a platform API, a token, or a network. Every
record says who produced it and whether it was observed by git or reported by the harness.

## ADDED Requirements

### Requirement: Records declare producer and trust class

Every capture record SHALL declare its producer (`harness` or `git`) and its trust class. A record written by
a session hook SHALL be `reported`. A fact read from commit history SHALL be `observed`. A read over the
projection SHALL state which trust classes it included, and no read SHALL promote a `reported` record to
`observed`.

#### Scenario: A session record is reported

- GIVEN a session file written by a harness hook
- WHEN the projection is rebuilt
- THEN its token and cost figures MUST carry producer `harness` and trust class `reported`

#### Scenario: A merge time is observed

- GIVEN a merge commit on the default branch
- WHEN the projection is rebuilt
- THEN its committer date MUST carry producer `git` and trust class `observed`

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
as reported.

#### Scenario: Recording a session needs no credential

- GIVEN a working copy with no platform or provider credential configured
- WHEN the session hook runs at the end of an agent session
- THEN it MUST write the session file without contacting any service

#### Scenario: No provider API is called for figures

- GIVEN a session hook invoked with no token figures from the harness
- WHEN it runs
- THEN it MUST record the session as missing figures
- AND it MUST NOT contact any model provider

### Requirement: Provider and model identifiers are data in capture records

Session files and the projection SHALL carry the provider and model identifiers the harness reports, as
data fields, so cost can be attributed by provider and by model. This is the only place a provider or model
name appears in repository-produced content; documentation, commit messages, and prose stay neutral.

#### Scenario: A provider identifier is a field, not prose

- GIVEN a session file naming a provider and a model
- WHEN the projection is rebuilt
- THEN the provider and model MUST appear as data fields on the session record
- AND no generated document MUST add a provider name outside those fields
