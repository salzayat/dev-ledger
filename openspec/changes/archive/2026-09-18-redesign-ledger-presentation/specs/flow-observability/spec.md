# flow-observability Specification Delta

## MODIFIED Requirements

### Requirement: The Ledger

The system SHALL provide one read surface, The Ledger, rendering the projection per repository and across the
registry: the flow signals and any thresholds exceeded, spend per spec reference, per provider, and per
model, cost per unit of recorded effort, the unmerged queue, undeclared, unreported, and out-of-band changes,
and unreachable repositories. Every figure SHALL show the trust classes it was computed from and its excluded
count, and SHALL be traceable to the changes and records it was computed from. The Ledger SHALL group its panels
into two levels of tabs navigated without script: three views, Metrics, Economics, and Records, each holding
sub-views, where Metrics holds Flow, DORA, and Throughput, Economics holds Spend and Effort, and Records holds
Changes, Queue, and Notes. Each sub-view SHALL be reachable by a fragment on the same page and selected by
CSS, so a sub-view is a URL and a link to one opens it, and a view SHALL mark itself current when any of its
sub-views is the target. Flow signals and the DORA keys SHALL occupy separate sub-views, and within a sub-view
the panels SHALL be grouped under the question each answers, each group carrying a heading. The page SHALL
contain no form control, as it already contains no script element and loads no external resource. The Ledger SHALL read only from the projection, and SHALL render an explicit
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
spend is shown: an allocated figure in the headline, a subscription spend panel listing each period
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

#### Scenario: Tabs need no script and no form

- GIVEN a projection with records
- WHEN `telemetry ledger --html` runs
- THEN the written page MUST group its panels into three views each holding sub-views
- AND it MUST contain no script element, no external resource, and no form control
- AND selecting a view or a sub-view MUST work from a `file:` URL

#### Scenario: A sub-view is a URL and its view follows it

- GIVEN the written page
- WHEN it is opened with the fragment of the Economics › Effort sub-view
- THEN the Effort panels MUST be the ones shown
- AND the Economics view and the Effort sub-view MUST both be marked current

#### Scenario: DORA and flow are separate tabs

- GIVEN a projection carrying release tags and flow signals
- WHEN an operator opens The Ledger
- THEN the DORA keys and the flow signals MUST appear in different sub-views
- AND a link carrying a sub-view's fragment MUST open that sub-view

## ADDED Requirements

### Requirement: The figure leads and the methodology folds beneath it

On the HTML dashboard every panel SHALL render, in order, its title with its trust classes, its figure and
any chart or table, a folded disclosure holding its methodology note, excluded count, and help text, and
then its citations. The disclosure SHALL be closed by default and SHALL open with no script. A citation
inside a table row SHALL stay in its row. Nothing a panel showed before the fold SHALL be removed from it.

#### Scenario: The figure precedes the methodology

- GIVEN a panel with a figure, a methodology note, and citations
- WHEN the dashboard is rendered
- THEN the figure MUST appear before the methodology note in document order
- AND the methodology note MUST be inside a closed disclosure element
- AND the panel's citations MUST follow that disclosure

#### Scenario: A table row keeps its own citations

- GIVEN a spend table whose rows each cite their session records
- WHEN the dashboard is rendered
- THEN each row's citations MUST remain inside that row

### Requirement: The headline composes figures the page already shows

Each repository on the HTML dashboard SHALL open with a headline: one sentence in words naming the typical
wait, the typical cycle, the typical active share of cycle time, and the spend of the newest period, and a
strip of five figures with a trend beside each: typical wait, typical cycle, the queue, merges per day, and
spend. Every figure in the sentence and the strip SHALL be the value its panel shows and SHALL link to the
sub-view holding that panel. The headline SHALL carry no figure that has no panel, SHALL render a currency
zero nowhere, and SHALL show the page's schema versions nowhere above it; the versions SHALL sit in the
footer.

#### Scenario: A headline figure reaches its panel

- GIVEN a repository with wait and cycle distributions
- WHEN an operator follows the typical wait link in the headline sentence
- THEN the Metrics › Flow sub-view MUST open
- AND the wait time panel there MUST show the same value, with its trust class, excluded count, and citations

#### Scenario: A subscription repository's headline shows the allocated figure

- GIVEN a repository whose every session is a subscription session with a period record
- WHEN the dashboard is rendered
- THEN the spend figure in the strip MUST be the allocated amount carrying `allocated`
- AND the strip MUST NOT render `$0.00`

#### Scenario: Provenance sits in the footer

- GIVEN a projection with records
- WHEN the dashboard is rendered
- THEN the projection, session, and registry schema versions MUST appear in the footer
- AND they MUST NOT appear before the first repository's headline
