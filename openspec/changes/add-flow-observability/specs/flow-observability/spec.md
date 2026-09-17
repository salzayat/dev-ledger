# flow-observability Specification

Flow observability turns the commit histories of one or more repositories into the signals an engineer
needs to find where work waits. It reads every repository over the git access a developer already has,
fetches everything the remote advertises including tags and pull head refs, and rebuilds a projection that
is byte-identical on any machine that fetched the same ref tips. It sees what git sees. Reviews, check
outcomes, and platform timestamps are not in scope here; the second phase, `add-change-audit`, adds them as an
option.

## ADDED Requirements

### Requirement: A registry of repositories synced over SSH

The system SHALL keep a version-controlled registry (`registry.json`) listing each repository with a name,
its SSH URL, its default branch, its release tag pattern, and its signal thresholds. `telemetry sync` SHALL
fetch each registered repository into a local mirror, including tags and `refs/pull/*/head`, using the
operator's own git access and nothing else, and SHALL record the ref tips it fetched. A repository that
cannot be fetched SHALL be recorded as unreachable with the reason, and every read covering it SHALL name
it as unreachable rather than omitting it silently.

#### Scenario: Sync fetches pull head refs

- GIVEN a registered repository on a host that advertises pull head refs
- WHEN `telemetry sync` runs
- THEN the local mirror MUST contain every advertised `refs/pull/*/head` and every tag

#### Scenario: An unreachable repository is named

- GIVEN a registry of four repositories of which one refuses the operator's SSH key
- WHEN `telemetry sync` runs and the projection is rebuilt
- THEN the projection MUST record that repository as unreachable with the reason
- AND every aggregate read MUST name it

#### Scenario: Sync needs no platform credential

- GIVEN a working copy with no platform API token configured
- WHEN `telemetry sync` runs
- THEN it MUST complete using git over SSH alone

### Requirement: A change is identified for every merge method

The projection SHALL treat a change, not a commit, as the unit of measurement, identified on the default
branch's first-parent history: a squash merge is one single-parent commit; a merge commit is a two-parent
commit whose change includes the commits reachable from its second parent and not from its first; and a
rebase merge is a run of consecutive single-parent commits sharing a `Change:` trailer. A single-parent
commit with no `Change:` trailer SHALL be its own change. A change's trailers SHALL be read from its merge
commit message when that message carries them, and otherwise from the union of its commits' trailers; a
single-valued trailer carrying different values across those commits SHALL be recorded as a
`conflicting-trailer` gap and treated as absent.

#### Scenario: A merge commit groups its branch commits

- GIVEN a merge commit on the default branch whose second parent reaches three branch commits not reachable
  from its first parent
- WHEN the projection is rebuilt
- THEN one change MUST contain the merge commit and those three commits

#### Scenario: A rebase merge groups by the change trailer

- GIVEN four consecutive single-parent commits on the default branch, three carrying `Change: c-9` and one
  carrying `Change: c-10`
- WHEN the projection is rebuilt
- THEN it MUST produce one change of three commits and one change of one commit

#### Scenario: Conflicting trailers are a gap

- GIVEN a rebase-merged change whose commits carry `Cost-Class: rd` and `Cost-Class: production` and no merge
  commit message
- WHEN the projection is rebuilt
- THEN it MUST list a `conflicting-trailer` gap for that change
- AND the change MUST be treated as carrying no cost class

### Requirement: Pull request association and population classification from git alone

The projection SHALL associate each change with a pull request by the pull request number in the merge or
squash commit subject, or by patch identity between the change's commits and a fetched pull head ref, and
SHALL record which method associated it. Every change on the default branch SHALL be classified
exhaustively as `pull-request` when associated or `out-of-band` otherwise. A pull head ref whose commits are
not reachable from the default branch SHALL be listed as an unmerged pull request with the age of its oldest
commit; whether it is open or closed is not observable from git and the read SHALL say so. Commits reachable
only through a merge commit's second parent SHALL belong to that merge's change and SHALL never be
classified on their own.

#### Scenario: A squash merge is associated by its subject

- GIVEN a squash commit whose subject ends with `(#48)` and a fetched `refs/pull/48/head`
- WHEN the projection is rebuilt
- THEN the change MUST be associated with pull request 48 by subject

#### Scenario: A rebase merge is associated by patch identity

- GIVEN a rebase-merged change whose rewritten commits share patch identity with the commits on
  `refs/pull/52/head`
- WHEN the projection is rebuilt
- THEN the change MUST be associated with pull request 52 by patch identity

#### Scenario: A direct push is out-of-band

- GIVEN a commit on the default branch matching no pull request subject and no pull head ref by patch
  identity
- WHEN the population is computed
- THEN it MUST be classified `out-of-band`

#### Scenario: An unmerged pull head is listed with its age

- GIVEN a `refs/pull/60/head` whose commits are not reachable from the default branch
- WHEN the unmerged read is requested
- THEN it MUST list pull request 60 with the age of its oldest commit
- AND it MUST state that open or closed is not observable offline

#### Scenario: The population is complete by construction

- GIVEN a period of the default branch's history
- WHEN the population is computed
- THEN every change in that period MUST fall into exactly one classification

### Requirement: Session declarations, and missing records counted rather than zeroed

A change with no `Session:` trailer on its merge commit message or any of its commits SHALL be marked
`undeclared` and listed as an `undeclared-session` gap. A change naming a session whose file is absent from
the tree at its last commit SHALL be marked `unreported` and listed as a `missing-session-record` gap. Both
SHALL be excluded from every cost and token figure with their counts stated, and neither SHALL be counted as
zero. A change whose commits carry `Session: none` SHALL be neither. Sessions found on an unmerged pull head
ref's tree SHALL be recorded as sessions of an unmerged pull request, so work that never ships keeps its
cost.

#### Scenario: A change naming a session with no file

- GIVEN a change carrying `Session: s-41` whose tree at its last commit has no file for `s-41`
- WHEN cost per change is requested
- THEN that change MUST be marked `unreported`
- AND it MUST NOT be counted as zero cost
- AND the figure MUST report it in the excluded count

#### Scenario: Human-only work is declared, not missing

- GIVEN a change whose commits carry `Session: none`
- WHEN the projection is rebuilt
- THEN it MUST NOT be marked `undeclared` or `unreported`

#### Scenario: Sessions on an unmerged pull head are kept

- GIVEN a pull head ref carrying two session files whose commits never reached the default branch
- WHEN the projection is rebuilt
- THEN both sessions MUST be recorded as `reported` sessions of an unmerged pull request

### Requirement: Timing is read from the pull head ref

For a change associated with a pull request, the projection SHALL read cycle time as the interval from the
earliest author date among the pull head ref's commits not reachable from the base to the merge commit's
committer date, and wait time as the interval from the latest author date among those commits to the merge
commit's committer date. It SHALL read those dates from the pull head ref rather than from the rewritten
commits on the default branch, so a rebase or squash does not erase them. A change with no pull head ref
SHALL have both figures recorded as absent with the reason, never as zero. The merge time SHALL be the
committer date of the merge or squash commit, and the read SHALL state that it is the merging party's
clock.

#### Scenario: Wait time survives a rebase merge

- GIVEN a pull request whose last commit was authored on Monday, rebase-merged on Thursday with committer
  dates rewritten to Thursday
- WHEN the projection is rebuilt
- THEN wait time MUST be three days, read from the pull head ref

#### Scenario: A change with no pull head has no timing

- GIVEN an out-of-band change
- WHEN cycle time is requested
- THEN it MUST be absent with the reason
- AND it MUST NOT be counted as zero

### Requirement: Flow signals per repository and in aggregate

The projection SHALL provide reads for cycle time and wait time distributions, the unmerged queue (count
and age), batch size (files, lines, and commits per change), merge frequency per day, rework (a change
touching files a change within the configured window also touched), escapes (a revert, or a change carrying
`fix` in its subject that touches files of a change in the most recent release, after that release's tag),
local check outcomes per change, and spend (tokens and cost) per change, per spec reference, per provider,
and per model, computed separately for each enabled effort unit where a unit applies. Each read SHALL be
available per repository and across the registry, SHALL state the trust classes it included and the number
of changes excluded for lacking what it needs, and SHALL raise a signal when a registered threshold is
exceeded, naming the threshold and the changes behind it. No read SHALL be keyed to a person, and the
projection SHALL NOT offer a person as a dimension.

#### Scenario: A wait-time threshold raises a signal

- GIVEN a registry entry with a wait-time threshold of two days and a period in which three changes waited
  longer
- WHEN the flow reads are computed
- THEN a signal MUST name the threshold and cite the three changes

#### Scenario: Cost per unit of effort excludes what it cannot measure

- GIVEN five changes of which two recorded story points
- WHEN cost per story point is requested
- THEN the result MUST be computed over those two only
- AND it MUST report that three changes were excluded for lacking the unit

#### Scenario: Cost is attributable per provider

- GIVEN changes carrying session records from two different coding-agent providers
- WHEN cost per provider is requested
- THEN each provider's tokens and cost MUST be reported separately
- AND their sum MUST equal the total reported cost

#### Scenario: No signal is keyed to a person

- GIVEN a projection whose session records carry operator identifiers
- WHEN any flow read is listed
- THEN none MUST group, rank, or trend a figure by operator identifier

### Requirement: Releases and release membership

The registry SHALL name each repository's release tag pattern. The projection SHALL record, for each release
tag reachable from the default branch, the commit it points at and the set of changes it contains, computed
as the commits reachable from that tag and not from the preceding release tag, in topological order. A
change SHALL be released when it belongs to at least one release and unreleased otherwise, with a read
listing unreleased changes. A change in a release whose commit differs from the merge that introduced it on
the default branch SHALL be resolved by the recorded cherry-pick reference or by patch identity, and one
that cannot be resolved SHALL be reported as unmapped. A change in more than one release SHALL be listed in
each and counted once in any aggregate. A tag whose target changed between rebuilds SHALL be reported.

#### Scenario: Release membership follows the tag's ancestry

- GIVEN two release tags and a set of changes between them
- WHEN release membership is computed
- THEN the later release MUST contain exactly the changes reachable from its tag and not from the earlier one

#### Scenario: A cherry-picked change resolves to its original merge

- GIVEN a release containing a commit cherry-picked from a change on the default branch
- WHEN release membership is computed
- THEN the change MUST carry the original change's records

#### Scenario: A moved tag is detectable

- GIVEN a release recorded against one commit and a tag later pointing at another
- WHEN the projection is rebuilt
- THEN the change of target MUST be reported

### Requirement: Projection rebuilt from history

The system SHALL materialize a projection by walking each registered repository's default branch in
topological order and reading commit messages and trailers, session files, tags, and pull head refs. The
projection SHALL be written as canonical JSON with sorted keys and a schema version, SHALL record the ref
tips it was built from, and SHALL be byte-identical on any machine whose mirrors hold the same ref tips.
It SHALL order events by the commit graph and never by author timestamp, and SHALL be deletable and
rebuildable with no loss.

#### Scenario: Two machines rebuild identically

- GIVEN two machines whose mirrors hold the same ref tips for every registered repository
- WHEN each runs the rebuild
- THEN both projections MUST be byte-identical

#### Scenario: A rebased timestamp does not reorder events

- GIVEN a merge commit whose author timestamp is earlier than its parent's
- WHEN the projection is rebuilt
- THEN the event order MUST follow the commit graph

#### Scenario: Deleting the projection loses nothing

- GIVEN a materialized projection
- WHEN it is deleted and rebuilt from the same mirrors
- THEN the rebuilt projection MUST be byte-identical to the deleted one

### Requirement: Cursor-based consumers

A consumer of the projection SHALL keep a cursor naming, per repository, the last default-branch commit it
processed, and SHALL replay from its cursor in topological order. Re-invoking a consumer with an unchanged
cursor SHALL process nothing. A cursor naming a commit no longer reachable from the default branch SHALL be
treated as invalid: the consumer SHALL reset to the nearest reachable ancestor, replay forward, and record
that it did so.

#### Scenario: A consumer resumes from its cursor

- GIVEN a consumer whose cursor names commit A and a default branch with two changes after A
- WHEN the consumer is invoked
- THEN it MUST process exactly those two changes in graph order
- AND its cursor MUST advance to the newest

#### Scenario: An unreachable cursor resets to a reachable ancestor

- GIVEN a consumer whose cursor names a commit no longer reachable from the default branch
- WHEN the consumer is invoked
- THEN it MUST reset to the nearest reachable ancestor and replay forward
- AND it MUST record that the reset happened

### Requirement: The Board

The system SHALL provide one read surface, The Board, rendering the projection per repository and across the
registry: the flow signals and any thresholds exceeded, spend per spec reference, per provider, and per
model, cost per unit of recorded effort, the unmerged queue, undeclared, unreported, and out-of-band changes,
and unreachable repositories. Every figure SHALL show the trust classes it was computed from and its excluded
count, and SHALL be traceable to the changes and records it was computed from. The Board SHALL NOT present
any figure keyed to an operator identifier, SHALL read only from the projection, and SHALL render an explicit
empty state when the projection has no records.

#### Scenario: The Board with an empty projection

- GIVEN a projection with no records
- WHEN an operator opens The Board
- THEN it MUST render with an explicit empty state rather than failing

#### Scenario: A figure enumerates its inputs

- GIVEN a panel showing cost for a spec reference
- WHEN an operator inspects the figure
- THEN it MUST list the changes and session records that produced it

#### Scenario: The Board shows no per-operator figure

- GIVEN a projection whose session records carry operator identifiers
- WHEN an operator opens The Board
- THEN no panel MUST group, rank, or trend any figure by operator identifier

### Requirement: Scripts and hooks

The repository SHALL provide `scripts/telemetry.sh` with `session`, `validate`, `sync`, `rebuild`, `cursor`,
and `board` subcommands, and a hook installer wired into the existing `.githooks` setup providing
`prepare-commit-msg`, `commit-msg`, `pre-commit`, `pre-push`, and the harness session-end hook. The
mechanism SHALL operate using git working copies and mirrors alone and SHALL NOT require any workflow,
hosted service, message broker, database server, or platform API.

#### Scenario: Rebuilding needs no network

- GIVEN mirrors already fetched and no network access
- WHEN `telemetry rebuild` runs
- THEN it MUST complete and produce the expected content hash

### Requirement: The projection is a published contract

The session file schema, the trailer vocabulary, the registry format, and the projection schema SHALL each
carry a version, and the projection SHALL name the versions it was built under. A change to any of them
SHALL bump its version, so the audit layer can tell which contract a projection was built under.

#### Scenario: A consumer reads the versions

- GIVEN a projection built under session schema 1 and projection schema 1
- WHEN a consumer opens it
- THEN it MUST find both versions named in the projection header
