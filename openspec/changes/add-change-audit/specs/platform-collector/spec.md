# platform-collector Specification

The platform collector is the optional producer of `observed` platform records: reviews and the commit each
approved, check outcomes, protection status, and deployment runs. It runs only in this repository's own
continuous integration, holds the only credential in the system, and writes its records into this
repository through a pull request. A repository with the collector off loses nothing phase one records;
it loses only the controls that need the platform, and every read says so.

## ADDED Requirements

### Requirement: The collector is optional and off by default

The collector SHALL be enabled per repository in that repository's governance configuration file and SHALL
be off by default. With the collector off, every gap type and control that needs collector records SHALL be
reported as `not-observable` with the reason `collector-off`. Enabling or disabling the collector SHALL be a
change to the configuration file through a pull request, recorded with the operator and a reason, and the
projection SHALL record the collector state in force for each period.

#### Scenario: Disabled by default

- GIVEN a repository with no collector setting
- WHEN a run executes
- THEN the collector-dependent controls MUST be `not-observable` with reason `collector-off`

#### Scenario: The state per period is recorded

- GIVEN a repository whose collector was enabled mid-quarter
- WHEN a run covers the quarter
- THEN the periods before the change MUST read as collector-off and the periods after as collector-on

### Requirement: One read-only credential, held only by this repository's CI

The collector SHALL run only as a workflow in this repository, on a schedule and on manual dispatch, using a
read-only credential (a fine-grained token or an installation token) stored as a secret in this repository
and nowhere else. The credential's scopes SHALL be limited to reading pull requests, reviews, checks,
workflow runs, deployments, and branch protection for the registered repositories, and the setup
documentation SHALL name them. No developer, agent session, or local rebuild SHALL need the credential. The
collector SHALL record the credential's expiry date when the platform reports one, and an expiry within the
configured warning period SHALL be raised as a finding.

#### Scenario: A local rebuild needs no credential

- GIVEN a clone of this repository and the synced mirrors, with no secret configured
- WHEN the audit projection is rebuilt
- THEN it MUST complete using the collector records already committed

#### Scenario: An expiring credential is a finding

- GIVEN a credential expiring within the configured warning period
- WHEN the collector runs
- THEN it MUST raise a finding naming the expiry date

### Requirement: Observed records arrive through a pull request in this repository

For each enabled repository, the collector SHALL read, for each default-branch commit not yet recorded, the
associated pull request, its merge method and the default-branch commits it produced, its open, merge, and
close times, every review with its state, reviewer class (`human` or `agent`), and the commit it was
submitted against, check outcomes for the merged commit, runs of the configured deployment workflow with
commit, environment, and completion time, and the branch's protection status including
`unavailable-on-plan`. It SHALL append `observed` records to `records/<repository>/<period>.jsonl` on a
branch it owns and SHALL open or update one standing pull request in this repository using the token issued
to its run, which starts no further workflow runs. It SHALL validate the records before pushing and write
the result into the pull request description. Records SHALL be appended, never edited; a correction SHALL
be an appended record referencing the one it corrects. No workflow SHALL commit to this repository's
default branch directly.

#### Scenario: A merge produces collector records

- GIVEN an enabled repository and a pull request merged to its default branch
- WHEN the collector runs
- THEN the standing pull request MUST contain observed records for that pull request's merge method,
  produced commits, reviews, checks, and times

#### Scenario: A workflow never writes to the default branch

- GIVEN the collector workflow
- WHEN it records facts
- THEN it MUST NOT push a commit to this repository's default branch
- AND the facts MUST reach it only when the standing pull request is merged

### Requirement: Reviews are observed from the platform

The collector SHALL record each review with its reviewer class, its state, and the commit it was submitted
against. A review SHALL satisfy the merged change only when that commit is the pull request's head at merge
or has the same patch identity; an earlier review SHALL remain readable but SHALL NOT carry forward. A human
review SHALL count toward `distinct-human` only when the reviewer account appears on the approved reviewer
list in the repository's configuration file as it stood at the merge's parent. An agent review SHALL be
`observed` only when its structured record names a workflow run the collector confirms against the
platform's run record for the same commit; any other agent review SHALL be `reported`.

#### Scenario: A stale approval does not carry forward

- GIVEN an approving review submitted against commit A and a later commit B pushed before merge
- WHEN the collector records the merge
- THEN the review MUST be recorded against A
- AND the merge MUST read as unreviewed at B

#### Scenario: An unlisted account does not count as an approved human reviewer

- GIVEN an approving review from an account absent from the approved reviewer list
- WHEN the collector records the merge
- THEN the review MUST be recorded
- AND it MUST NOT count toward `distinct-human`

### Requirement: Collector records are checked against the flow projection and against the platform

The flow projection SHALL remain authoritative for git facts and the collector's records for
platform facts. Where the collector's pull request to commit mapping disagrees with the flow projection's offline
association, the projection SHALL use the collector's mapping and SHALL report the disagreement. Each
scheduled run SHALL re-derive a configured look-back period from the platform within a configured request
budget, SHALL record the span it covered, and SHALL append a `restated-record` for every difference between
the re-derived facts and the records on this repository's default branch, naming the record, the field, and
both values, without altering the original.

#### Scenario: An association disagreement is reported

- GIVEN a change the flow projection associated with pull request 48 by subject and a collector record mapping
  its commits to pull request 47
- WHEN the projection is rebuilt
- THEN it MUST use pull request 47
- AND it MUST report the disagreement

#### Scenario: A hand-edited record is detected

- GIVEN a collector record on the default branch whose merge time was edited after it was merged
- WHEN the next scheduled run executes
- THEN it MUST append a restated-record naming that record, the merge time field, and both values

### Requirement: Records outlive continuous-integration retention

The collector SHALL run at least weekly so that every fact a rule cites is captured as a record on this
repository's default branch before the platform's run logs and artifacts expire, and the system SHALL
treat those logs and artifacts as a cache, never as the record.

#### Scenario: A cited fact is recorded before its artifact expires

- GIVEN a check outcome available only in a run's artifacts
- WHEN the collector next runs
- THEN that outcome MUST be appended as an observed record
- AND rules MUST read it from the record, not from the artifact
