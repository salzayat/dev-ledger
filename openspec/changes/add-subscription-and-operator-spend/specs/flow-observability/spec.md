# flow-observability Specification Delta

## ADDED Requirements

### Requirement: Subscription spend is allocated by agent run seconds

The projection SHALL join each subscription cost record to the sessions whose end falls in its period, and
SHALL apportion that period's amount across those sessions in proportion to each session's
`agentRunSeconds`. Overage SHALL be apportioned on the same basis and SHALL be reported as a component
distinct from the plan amount. A session whose `agentRunSeconds` is zero or absent SHALL receive no share,
SHALL be reported in the allocation's excluded count, and SHALL NOT be presented as zero cost. When no
session in a period carries non-zero `agentRunSeconds`, that period's whole amount SHALL be reported as
unallocated rather than apportioned evenly. An allocated figure SHALL cite the subscription cost record and
every session record behind it, and SHALL carry the trust class `allocated`. A figure drawn from a period
whose end has not passed SHALL be marked provisional.

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

- GIVEN a subscription cost record for a period whose end has not passed
- WHEN a figure drawn from it is rendered
- THEN it MUST be marked provisional
- AND the same figure for a closed period MUST NOT be

#### Scenario: Overage is reported separately from the plan amount

- GIVEN a subscription cost record carrying a plan amount and a non-zero overage amount
- WHEN spend for that period is requested
- THEN the plan component and the overage component MUST be reported separately

### Requirement: The operator dimension covers agents and humans alike

The projection and The Board SHALL offer the operator as a dimension, covering agent operators identified by
provider and model and human operators identified by the pseudonymous `operatorId`. Agent effort SHALL be
reported in the currency of the subscription cost record and in tokens where reported; human effort SHALL be
reported in hours derived from `operatorActiveSeconds`. No read and no rendered figure SHALL multiply a
human operator's hours by any rate, express a human operator's effort in currency, or sum a figure in hours
with a figure in currency. No read SHALL resolve an `operatorId` to a name or an email address. A change
whose commits carry `Session: none`, and a session recorded before operator capture was enabled, SHALL be
excluded from the human-hours figure with their counts stated, and SHALL NOT be counted as zero hours.

#### Scenario: Agent and human effort are reported in their own units

- GIVEN a change with a session carrying both `agentRunSeconds` and `operatorActiveSeconds`
- WHEN the operator dimension is requested
- THEN the agent figure MUST be in currency and tokens
- AND the human figure MUST be in hours
- AND no figure MUST combine the two units

#### Scenario: Human effort is never priced

- GIVEN a projection whose session records carry `operatorActiveSeconds`
- WHEN any read or rendered page is produced
- THEN none MUST multiply those seconds by a rate
- AND none MUST express a human operator's effort as a currency amount

#### Scenario: Human-only work is excluded from hours, not zeroed

- GIVEN a change whose commits carry `Session: none`
- WHEN human hours are requested
- THEN that change MUST be reported in the excluded count
- AND it MUST NOT be counted as zero hours

#### Scenario: An operator identifier is never resolved to a person

- GIVEN a projection whose session records carry pseudonymous operator identifiers
- WHEN the operator dimension is rendered
- THEN no name or email address MUST appear
- AND each human operator MUST be identified by its pseudonymous identifier alone

### Requirement: The Board, one read surface over the projection

The system SHALL provide one read surface, The Board, rendering the projection per repository and across the
registry: the flow signals and any thresholds exceeded, spend per spec reference, per provider, per model,
and per operator, cost per unit of recorded effort, the unmerged queue, undeclared, unreported, and out-of-band changes,
and unreachable repositories. Every figure SHALL show the trust classes it was computed from and its excluded
count, and SHALL be traceable to the changes and records it was computed from. An allocated figure SHALL
show its basis, and a figure drawn from an open period SHALL be marked provisional. The Board SHALL present
human operator effort in hours and agent operator effort in currency and tokens, SHALL NOT sum the two,
SHALL NOT price human effort at any rate, and SHALL identify a human operator by its pseudonymous
identifier alone. The Board SHALL read only from the projection, and SHALL render an explicit
empty state when the projection has no records. The Board SHALL be available as a terminal render and as a
static HTML dashboard written by `telemetry board --html`: one self-contained page with inline styles and
inline SVG, containing no script element and loading no external resource, readable from a file URL, laid out
per repository with each figure's trust classes and excluded count beside it and its citations expandable
beneath it, working in light and dark color schemes and at phone width. On the HTML dashboard every cited
commit SHALL render as its abbreviated hash beside the change's subject, and SHALL link to that commit on the
hosting platform when the repository's web URL is recorded; a cited pull request SHALL link to that pull
request and a cited session record to that file on the default branch. A hyperlink to the hosting platform is
navigation and SHALL NOT be treated as an external resource; when no web URL is recorded the same text SHALL
render with no hyperlink. On the HTML dashboard the unmerged queue SHALL show each pull request's spend beside its age, and the recent-changes table SHALL show each change's spend, each rendering what the records say rather than a zero when figures are missing, with every session record cited. The Board SHALL show the four DORA
reads as a strip of cards, each with its approximation note and its citations, a spend-over-time chart with
the same weekly buckets as merge activity, a spend-by-cost-class panel, and the coverage counts, on both the
HTML dashboard and the terminal render.

#### Scenario: The Board with an empty projection

- GIVEN a projection with no records
- WHEN an operator opens The Board
- THEN it MUST render with an explicit empty state rather than failing

#### Scenario: A figure enumerates its inputs

- GIVEN a panel showing cost for a spec reference
- WHEN an operator inspects the figure
- THEN it MUST list the changes and session records that produced it

#### Scenario: The Board shows operator effort in its own unit

- GIVEN a projection whose session records carry both `agentRunSeconds` and `operatorActiveSeconds`
- WHEN an operator opens The Board
- THEN the operator panel MUST show human effort in hours and agent effort in currency and tokens
- AND no panel MUST sum a figure in hours with a figure in currency
- AND no panel MUST show a human operator's effort as a currency amount

#### Scenario: An operator identifier is never resolved to a person

- GIVEN a projection whose session records carry pseudonymous operator identifiers
- WHEN the operator dimension is rendered
- THEN no name or email address MUST appear
- AND each human operator MUST be identified by its pseudonymous identifier alone

#### Scenario: An allocated figure shows its basis

- GIVEN a spend panel computed by apportioning a subscription amount
- WHEN an operator opens The Board
- THEN that figure MUST carry the trust class `allocated`
- AND it MUST show the basis it was apportioned by
- AND it MUST cite the subscription cost record behind it

#### Scenario: The dashboard is one self-contained page

- GIVEN a projection with records
- WHEN `telemetry board --html` runs
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

## MODIFIED Requirements

### Requirement: Session declarations, and missing records counted rather than zeroed

A change with no `Session:` trailer on its merge commit message or any of its commits SHALL be marked
`undeclared` and listed as an `undeclared-session` gap. A change naming a session whose file is absent from
the tree at its last commit SHALL be marked `unreported` and listed as a `missing-session-record` gap. Both
SHALL be excluded from every cost and token figure with their counts stated, and neither SHALL be counted as
zero. A change whose commits carry `Session: none` SHALL be neither. Sessions found on an unmerged pull head
ref's tree SHALL be recorded as sessions of an unmerged pull request, so work that never ships keeps its
cost. A session record carrying `figuresMissing` SHALL be excluded from every reported cost and token figure
and counted as excluded, on unmerged pull requests exactly as on merged changes, and SHALL NOT be counted as
zero in either. `figuresMissing` SHALL NOT exclude a record from an allocated figure: a record carrying
`figuresMissing` and a non-zero `agentRunSeconds` SHALL take its allocated share, and the excluded counts for
reported figures and for allocated figures SHALL be stated separately because they exclude different records.

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

- GIVEN a session record carrying `figuresMissing` and an `agentRunSeconds` of 2280 in an allocated period
- WHEN allocated spend for that period is requested
- THEN that record MUST take its share in proportion to its agent seconds
- AND it MUST still be reported in the excluded count for reported figures
- AND the two excluded counts MUST be stated separately

### Requirement: Flow signals per repository and in aggregate

The projection SHALL provide reads for cycle time and wait time distributions, the unmerged queue (count
and age), batch size (files, lines, and commits per change), merge frequency per day, rework (a change
touching files a change within the configured window also touched), escapes (a revert, or a change carrying
`fix` in its subject that touches files of a change in the most recent release, after that release's tag),
local check outcomes per change, and spend (tokens and cost) per change, per unmerged pull request, per
spec reference, per provider, per model, and per operator, computed separately for each enabled effort unit
where a unit applies. It SHALL also provide the four DORA reads approximated to the release tag, each carrying a note
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
including the records excluded from its figures. A read keyed to an operator SHALL identify a human
operator by its pseudonymous identifier alone and SHALL report human effort in hours only, never in
currency, and no read SHALL resolve that identifier to a name or an email address.

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
- AND their sum MUST equal the total allocated and reported cost over the same records

#### Scenario: Spend is attributable to one unmerged pull request

- GIVEN an unmerged pull request with two session records, one carrying figures and one carrying
  `figuresMissing`
- WHEN spend per unmerged pull request is requested
- THEN that pull request's figures MUST be computed from the first record only
- AND it MUST report one record excluded for missing figures
- AND it MUST cite both records

#### Scenario: No signal is keyed to a person

- GIVEN a projection whose session records carry pseudonymous operator identifiers
- WHEN any flow read keyed to an operator is computed
- THEN it MUST NOT resolve an identifier to a name or an email address
- AND no read MUST be keyed to anything identifying a person

#### Scenario: A signal keyed to an operator stays pseudonymous and in hours

- GIVEN a projection whose session records carry pseudonymous operator identifiers
- WHEN a read keyed to a human operator is computed
- THEN it MUST identify that operator by its pseudonymous identifier alone
- AND it MUST report that operator's effort in hours
- AND it MUST NOT report that operator's effort in currency

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

## REMOVED Requirements

### Requirement: The Board

**Reason**: Its prohibition on presenting any figure keyed to an operator identifier is superseded; the
surface itself is unchanged and continues under a new title.
**Migration**: "The Board, one read surface over the projection" carries every property of this requirement
except that prohibition, and adds the operator dimension, the allocated trust class, and the provisional
marker. The retired scenario "The Board shows no per-operator figure" is replaced by "The Board shows
operator effort in its own unit"; pseudonymity is carried by "An operator identifier is never resolved to a
person" and by the unchanged guards at `packages/capture/src/session.ts:42` and
`packages/capture/src/config.ts:143`.
