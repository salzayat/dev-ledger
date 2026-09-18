# flow-observability Specification

## Purpose

Turn the commit histories of one or more repositories, fetched over the git access a developer already
has, into the signals an engineer needs to find where work waits: cycle and wait time, the unmerged queue,
batch size, rework, escapes, and spend per change, rebuilt into a projection that is byte-identical on any
machine holding the same ref tips and rendered on one read surface, The Ledger. Reviews, checks, and
platform timestamps are out of scope here and belong to phase two.

## Requirements

### Requirement: A registry of repositories synced over SSH

The system SHALL keep a version-controlled registry (`registry.json`) listing each repository with a name,
its SSH URL, its default branch, its release tag pattern, its signal thresholds, and optionally an explicit
browsable web URL, which SHALL be an https URL or a registry error. `telemetry sync` SHALL fetch each
registered repository into a local mirror, including tags and `refs/pull/*/head`, using the operator's own
git access and nothing else, and SHALL record the ref tips it fetched. A repository that cannot be fetched
SHALL be recorded as unreachable with the reason, and every read covering it SHALL name it as unreachable
rather than omitting it silently. A sync MAY be given a fetch URL overriding that of one named registry
entry, for an environment that reaches the same repository over a different transport; the override SHALL
apply to that entry alone, SHALL NOT modify `registry.json`, and SHALL NOT change the ref tips recorded,
so a projection rebuilt from an overridden sync is identical to one rebuilt from a sync without it against
the same source.

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

#### Scenario: An explicit web URL must be browsable

- GIVEN a registry entry whose `webUrl` is a `file:` URL
- WHEN the registry is parsed
- THEN the entry MUST be reported as an error naming the field

#### Scenario: An overridden fetch URL changes the transport and nothing else

- GIVEN a registry entry whose URL is an SSH remote, and a sync given an HTTPS fetch URL for that entry
- WHEN `telemetry sync` runs and the projection is rebuilt
- THEN the recorded ref tips MUST equal those recorded by a sync without the override against the same source
- AND `registry.json` MUST be unchanged
- AND no other registry entry MUST be fetched from an overridden URL

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
cost. A session record carrying `figuresMissing` SHALL be excluded from every reported cost and token figure and counted as excluded, on
unmerged pull requests exactly as on merged changes, and SHALL NOT be counted as zero in either.
`figuresMissing` SHALL NOT exclude a record from an allocated figure: a record carrying `figuresMissing`
and a non-zero `agentRunSeconds` SHALL take its allocated share, and the excluded counts for reported
figures and for allocated figures SHALL be stated separately because they exclude different records.

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

#### Scenario: A record with missing figures on an unmerged pull request is not zeroed

- GIVEN an unmerged pull request whose only session record carries `figuresMissing`
- WHEN spend on unmerged pull requests is requested
- THEN that record MUST contribute no cost, no tokens, and no counted session
- AND the figure MUST report it in its excluded count
- AND no panel MUST present that pull request's cost as zero

#### Scenario: A record with missing figures still takes an allocated share

- GIVEN a session record carrying `figuresMissing` and an `agentRunSeconds` of 600 in an allocated period
- WHEN allocated spend for that period is requested
- THEN that record MUST take its share in proportion to its agent seconds
- AND it MUST still be reported in the excluded count for reported figures
- AND the two excluded counts MUST be stated separately

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
local check outcomes per change, and spend (tokens and cost) per change, per unmerged pull request, per
spec reference, per provider, and per model, computed separately for each enabled effort unit where a unit
applies. It SHALL also provide the four DORA reads approximated to the release tag, each carrying a note
naming the approximation: deployment frequency as releases per week over the measured window, citing the
tags; lead time for changes as the interval from a change's first commit to the release tag that carried it,
with the merge-to-tag interval reported separately and unreleased changes excluded by reason; change
failure rate as escapes divided by releases in the window, with the denominator stated; and time to fix as
the interval from the merge of the released change an escape targets, resolved by shared files, to the
merge of the escape. It SHALL provide weekly trends of changes merged and session cost over the measured
window, spend by cost class (`rd`, `production`, `unclassified`, taken from the session's cost class, then
the change's `Cost-Class:` trailer, never defaulted), and coverage counts of changes with an agent session,
human-only, undeclared, and unreported. Each read SHALL be available per repository and across the
registry, SHALL state the trust classes it included and the number of changes excluded for lacking what it
needs, and SHALL raise a signal when a registered threshold is exceeded, naming the threshold and the
changes behind it. Spend per unmerged pull request SHALL cite every session record of that pull request,
including the records excluded from its figures. No read SHALL be keyed to a person, and the projection
SHALL NOT offer a person as a dimension.

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

#### Scenario: Spend is attributable to one unmerged pull request

- GIVEN an unmerged pull request with two session records, one carrying figures and one carrying
  `figuresMissing`
- WHEN spend per unmerged pull request is requested
- THEN that pull request's figures MUST be computed from the first record only
- AND it MUST report one record excluded for missing figures
- AND it MUST cite both records

#### Scenario: No signal is keyed to a person

- GIVEN a projection whose session records carry operator identifiers
- WHEN any flow read is listed
- THEN none MUST group, rank, or trend a figure by operator identifier

#### Scenario: Deployment frequency counts release tags and says so

- GIVEN two release tags fourteen days apart
- WHEN the DORA reads are computed
- THEN deployment frequency MUST report one release per week citing both tags
- AND its note MUST state that releases stand in for deployments

#### Scenario: Lead time runs to the tag and excludes unreleased work

- GIVEN a change merged and carried by a later release tag, and a change merged after the newest tag
- WHEN lead time to release is computed
- THEN the first change's value MUST be the interval from its first commit to that tag
- AND the second change MUST be excluded with the reason `unreleased`

#### Scenario: Change failure rate states its denominator

- GIVEN two releases and one escape after the newest
- WHEN change failure rate is computed
- THEN it MUST report 0.5 escapes per release over 2 releases citing the escape

#### Scenario: Time to fix runs from the targeted change's merge

- GIVEN a released change and a later `fix` change touching one of its files
- WHEN time to fix is computed
- THEN its value MUST be the interval between the two merges
- AND it MUST cite the fix and the change it targets

#### Scenario: Spend by cost class is never defaulted

- GIVEN a change carrying `Cost-Class: production` with two sessions, one carrying its own class `rd`, and a
  change with no class anywhere
- WHEN spend by cost class is computed
- THEN the `rd` session's figures MUST be under `rd`, the other under `production`, and the unclassed change
  under `unclassified`

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
rebuildable with no loss. The projection SHALL record, per repository, the registry entry's explicit web
URL when one is given, otherwise the web URL derived from its remote when that remote is `github.com` or a
GitHub Enterprise host, and SHALL record no local filesystem path. A remote whose host is an SSH alias SHALL
derive no web URL.

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

#### Scenario: A local registry URL records no path

- GIVEN a registry entry whose URL is a local filesystem path
- WHEN the projection is rebuilt
- THEN the repository's web URL MUST be null
- AND the projection MUST NOT contain that path

#### Scenario: An SSH alias derives no link, and the entry may supply one

- GIVEN a registry entry whose URL is `git@github.com-work:owner/repo.git`
- WHEN the projection is rebuilt without an explicit `webUrl`
- THEN the repository's web URL MUST be null
- AND WHEN the entry names `webUrl` as `https://github.com/owner/repo`
- THEN the projection MUST record that URL

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

### Requirement: The Ledger

The system SHALL provide one read surface, The Ledger, rendering the projection per repository and across the
registry: the flow signals and any thresholds exceeded, spend per spec reference, per provider, and per
model, cost per unit of recorded effort, the unmerged queue, undeclared, unreported, and out-of-band changes,
and unreachable repositories. Every figure SHALL show the trust classes it was computed from and its excluded
count, and SHALL be traceable to the changes and records it was computed from. The Ledger SHALL NOT present
any figure keyed to an operator identifier, SHALL read only from the projection, and SHALL render an explicit
empty state when the projection has no records. The Ledger SHALL be available as a terminal render and as a
static HTML dashboard written by `telemetry ledger --html`: one self-contained page with inline styles and
inline SVG, containing no script element and loading no external resource, readable from a file URL, laid out
per repository with each figure's trust classes and excluded count beside it and its citations expandable
beneath it, working in light and dark color schemes and at phone width. On the HTML dashboard every cited
commit SHALL render as its abbreviated hash beside the change's subject, and SHALL link to that commit on the
hosting platform when the repository's web URL is recorded; a cited pull request SHALL link to that pull
request and a cited session record to that file on the default branch. A hyperlink to the hosting platform is
navigation and SHALL NOT be treated as an external resource; when no web URL is recorded the same text SHALL
render with no hyperlink. On the HTML dashboard the unmerged queue SHALL show each pull request's spend beside its age, and the recent-changes table SHALL show each change's spend, each rendering what the records say rather than a zero when figures are missing, with every session record cited. The Ledger SHALL show the four DORA
reads as a strip of cards, each with its approximation note and its citations, a spend-over-time chart with
the same weekly buckets as merge activity, a spend-by-cost-class panel, and the coverage counts, on both the
HTML dashboard and the terminal render. The Ledger SHALL show allocated subscription spend where reported
spend is shown: an allocated figure in the summary strip, a subscription spend panel listing each period
with its plan, amount, overage, sessions allocated over, sessions excluded for no agent seconds, and
whether it is closed, provisional, or unallocated, an allocated column on the spend tables, and the
allocated share beside the reported spend in the queue and changes tables. Every allocated figure SHALL
carry the trust class `allocated`, SHALL be marked provisional when its period has not closed, and SHALL
cite the period record behind it; two currencies SHALL NOT be summed.

#### Scenario: The Ledger with an empty projection

- GIVEN a projection with no records
- WHEN an operator opens The Ledger
- THEN it MUST render with an explicit empty state rather than failing

#### Scenario: A figure enumerates its inputs

- GIVEN a panel showing cost for a spec reference
- WHEN an operator inspects the figure
- THEN it MUST list the changes and session records that produced it

#### Scenario: The Ledger shows no per-operator figure

- GIVEN a projection whose session records carry operator identifiers
- WHEN an operator opens The Ledger
- THEN no panel MUST group, rank, or trend any figure by operator identifier

#### Scenario: The dashboard is one self-contained page

- GIVEN a projection with records
- WHEN `telemetry ledger --html` runs
- THEN it MUST write one HTML file that contains no script element, no stylesheet or resource reference, and
  no style rule loading a resource
- AND opening that file from a file URL MUST show every panel with its trust classes, excluded count, and
  citations without a network request

#### Scenario: The dashboard renders in both color schemes and at phone width

- GIVEN the written page
- WHEN it is viewed with a dark color scheme, or in a viewport 400 pixels wide
- THEN every panel MUST remain readable with its figures and citations visible

#### Scenario: A cited commit names its change and reaches the platform

- GIVEN a repository whose registry URL is a GitHub remote and a panel citing a change
- WHEN an operator expands that panel's citations
- THEN each citation MUST show the abbreviated hash and that change's subject
- AND the hash MUST link to that commit under the repository's web URL

#### Scenario: A repository with no web URL renders the same citations unlinked

- GIVEN a repository whose registry URL is a local path
- WHEN the dashboard is rendered
- THEN its citations MUST still show the abbreviated hash and the change's subject
- AND the page MUST contain no hyperlink for that repository

#### Scenario: The queue shows what each pull request has cost

- GIVEN an unmerged pull request with a session record carrying figures
- WHEN an operator opens the dashboard
- THEN that pull request's row MUST show its cost, tokens, and session count
- AND the row MUST cite the session records behind them

#### Scenario: A pull request whose records carry no figures shows no cost

- GIVEN an unmerged pull request whose every session record carries `figuresMissing`
- WHEN an operator opens the dashboard
- THEN that pull request's row MUST say its figures are missing rather than showing a currency figure
- AND it MUST still cite those records

#### Scenario: A change with no declared session shows why, not a zero

- GIVEN a change on the default branch carrying no `Session:` trailer
- WHEN an operator opens the dashboard
- THEN that change's row in the recent-changes table MUST read `undeclared` in place of a spend figure

#### Scenario: The DORA strip names its approximations

- GIVEN a repository with release tags
- WHEN an operator opens the dashboard
- THEN four cards MUST show deployment frequency, lead time to release, change failure rate, and time to
  fix, each with a note naming the release tag as the approximation and each citing its tags or changes

#### Scenario: An allocated figure shows its class, its period, and its provisional state

- GIVEN a subscription cost record for the period of the newest commit and a session in it with agent seconds
- WHEN an operator opens The Ledger
- THEN the subscription spend panel MUST list that period as provisional citing the record
- AND the session's change MUST show its allocated share beside its reported spend, carrying `allocated`

#### Scenario: No period record renders as absence, not as zero

- GIVEN a repository with subscription sessions and no subscription cost record
- WHEN an operator opens The Ledger
- THEN the allocated figure MUST read as no period record
- AND every subscription session MUST be counted as excluded for lacking one

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

### Requirement: Subscription spend is allocated by agent run seconds

The projection SHALL read subscription cost records from the default branch, SHALL join each record to the
sessions whose end falls in its period and whose `subscriptionId` names its plan, and SHALL apportion that
period's amount across those sessions in proportion to each session's `agentRunSeconds`, with the shares
summing to the amount. Overage SHALL be apportioned on the same basis and reported as a component distinct
from the plan amount. A session whose `agentRunSeconds` is zero or absent SHALL receive no share, SHALL be
reported in the allocation's excluded count, and SHALL NOT be presented as zero cost; a subscription
session whose period and plan have no record SHALL be excluded and counted the same way, and an invalid
record SHALL be counted. When no session in a period carries non-zero `agentRunSeconds`, that period's whole
amount SHALL be reported as unallocated rather than apportioned evenly. An allocated figure SHALL cite the
subscription cost record and every session record behind it, SHALL carry the trust class `allocated` and
name its basis, and SHALL be aggregated per currency, never across currencies, into a total and figures by
change, by spec reference, by provider, by model, and per unmerged pull request. A figure drawn from a
period whose end has not passed as of the newest commit the mirror holds SHALL be marked provisional, so the
projection stays a function of the ref tips.

#### Scenario: A period's shares sum to its amount

- GIVEN a subscription cost record for a period and three sessions in it carrying non-zero agent seconds
- WHEN the period is allocated
- THEN each session's share MUST be proportional to its `agentRunSeconds`
- AND the shares MUST sum to the period's amount

#### Scenario: A session with no agent seconds is excluded, not zeroed

- GIVEN a period whose sessions include two with non-zero agent seconds and one with zero
- WHEN the period is allocated
- THEN the two MUST divide the whole amount between them
- AND the third MUST be reported in the excluded count
- AND no panel MUST present the third as zero cost

#### Scenario: A period with no agent seconds anywhere is unallocated

- GIVEN a subscription cost record for a period in which every session carries zero agent seconds
- WHEN the period is allocated
- THEN the whole amount MUST be reported as unallocated
- AND no session MUST receive a share

#### Scenario: An open period is provisional

- GIVEN a subscription cost record for the period of the newest commit the mirror holds
- WHEN a figure drawn from it is rendered
- THEN it MUST be marked provisional
- AND the same figure for a period that has closed MUST NOT be

#### Scenario: Overage is reported separately from the plan amount

- GIVEN a subscription cost record carrying a plan amount and a non-zero overage amount
- WHEN spend for that period is requested
- THEN the plan component and the overage component MUST be reported separately

#### Scenario: A session on a plan with no period record is excluded

- GIVEN a subscription session whose period has no subscription cost record for its plan
- WHEN the allocation is computed
- THEN that session MUST take no share
- AND it MUST be reported in the excluded count for lacking a period record
