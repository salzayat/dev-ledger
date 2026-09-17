# flow-observability Specification Delta

## MODIFIED Requirements

### Requirement: Session declarations, and missing records counted rather than zeroed

A change with no `Session:` trailer on its merge commit message or any of its commits SHALL be marked
`undeclared` and listed as an `undeclared-session` gap. A change naming a session whose file is absent from
the tree at its last commit SHALL be marked `unreported` and listed as a `missing-session-record` gap. Both
SHALL be excluded from every cost and token figure with their counts stated, and neither SHALL be counted as
zero. A change whose commits carry `Session: none` SHALL be neither. Sessions found on an unmerged pull head
ref's tree SHALL be recorded as sessions of an unmerged pull request, so work that never ships keeps its
cost. A session record carrying `figuresMissing` SHALL be excluded from every cost and token figure and
counted as excluded, on unmerged pull requests exactly as on merged changes, and SHALL NOT be counted as
zero in either.

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

### Requirement: Flow signals per repository and in aggregate

The projection SHALL provide reads for cycle time and wait time distributions, the unmerged queue (count
and age), batch size (files, lines, and commits per change), merge frequency per day, rework (a change
touching files a change within the configured window also touched), escapes (a revert, or a change carrying
`fix` in its subject that touches files of a change in the most recent release, after that release's tag),
local check outcomes per change, and spend (tokens and cost) per change, per unmerged pull request, per
spec reference, per provider, and per model, computed separately for each enabled effort unit where a unit
applies. Each read SHALL be available per repository and across the registry, SHALL state the trust classes
it included and the number of changes excluded for lacking what it needs, and SHALL raise a signal when a
registered threshold is exceeded, naming the threshold and the changes behind it. Spend per unmerged pull
request SHALL cite every session record of that pull request, including the records excluded from its
figures. No read SHALL be keyed to a person, and the projection SHALL NOT offer a person as a dimension.

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
render with no hyperlink. On the HTML dashboard the unmerged queue SHALL show each pull request's spend beside its age, and the recent-changes table SHALL show each change's spend, each rendering what the records say rather than a zero when figures are missing, with every session record cited.

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
