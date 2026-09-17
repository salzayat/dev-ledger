# flow-observability Specification Delta

## MODIFIED Requirements

### Requirement: Projection rebuilt from history

The system SHALL materialize a projection by walking each registered repository's default branch in
topological order and reading commit messages and trailers, session files, tags, and pull head refs. The
projection SHALL be written as canonical JSON with sorted keys and a schema version, SHALL record the ref
tips it was built from, and SHALL be byte-identical on any machine whose mirrors hold the same ref tips.
It SHALL order events by the commit graph and never by author timestamp, and SHALL be deletable and
rebuildable with no loss. The projection SHALL record, per repository, the web URL of its remote when the
registry URL is a recognizable hosting remote, and SHALL record no local filesystem path.

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
render with no hyperlink.

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
