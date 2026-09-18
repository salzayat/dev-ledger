# flow-observability Specification Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: The Board

The system SHALL provide one read surface, The Board, rendering the projection per repository and across the
registry: the flow signals and any thresholds exceeded, spend per spec reference, per provider, and per
model, cost per unit of recorded effort, the unmerged queue, undeclared, unreported, and out-of-band changes,
and unreachable repositories. Every figure SHALL show the trust classes it was computed from and its excluded
count, and SHALL be traceable to the changes and records it was computed from. The Board SHALL NOT present
any figure keyed to an operator identifier, SHALL read only from the projection, and SHALL render an explicit
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
HTML dashboard and the terminal render. The Board SHALL show allocated subscription spend where reported
spend is shown: an allocated figure in the summary strip, a subscription spend panel listing each period
with its plan, amount, overage, sessions allocated over, sessions excluded for no agent seconds, and
whether it is closed, provisional, or unallocated, an allocated column on the spend tables, and the
allocated share beside the reported spend in the queue and changes tables. Every allocated figure SHALL
carry the trust class `allocated`, SHALL be marked provisional when its period has not closed, and SHALL
cite the period record behind it; two currencies SHALL NOT be summed.

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

#### Scenario: An allocated figure shows its class, its period, and its provisional state

- GIVEN a subscription cost record for the period of the newest commit and a session in it with agent seconds
- WHEN an operator opens The Board
- THEN the subscription spend panel MUST list that period as provisional citing the record
- AND the session's change MUST show its allocated share beside its reported spend, carrying `allocated`

#### Scenario: No period record renders as absence, not as zero

- GIVEN a repository with subscription sessions and no subscription cost record
- WHEN an operator opens The Board
- THEN the allocated figure MUST read as no period record
- AND every subscription session MUST be counted as excluded for lacking one
