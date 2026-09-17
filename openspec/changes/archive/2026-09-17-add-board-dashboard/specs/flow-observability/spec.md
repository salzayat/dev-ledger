# flow-observability Specification Delta

## MODIFIED Requirements

### Requirement: The Board

The system SHALL provide one read surface, The Board, rendering the projection per repository and across the
registry: the flow signals and any thresholds exceeded, spend per spec reference, per provider, and per
model, cost per unit of recorded effort, the unmerged queue, undeclared, unreported, and out-of-band changes,
and unreachable repositories. Every figure SHALL show the trust classes it was computed from and its excluded
count, and SHALL be traceable to the changes and records it was computed from. The Board SHALL NOT present
any figure keyed to an operator identifier, SHALL read only from the projection, and SHALL render an explicit
empty state when the projection has no records. The Board SHALL be available as a terminal render and as a
static HTML dashboard written by `telemetry board --html`: one self-contained page with inline styles and
inline SVG, no script, and no external resource, readable from a file URL, laid out per repository with each
figure's trust classes and excluded count beside it and its citations expandable beneath it, working in light
and dark color schemes and at phone width.

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
- THEN it MUST write one HTML file that contains no script element and references no external resource
- AND opening that file from a file URL MUST show every panel with its trust classes, excluded count, and
  citations

#### Scenario: The dashboard renders in both color schemes and at phone width

- GIVEN the written page
- WHEN it is viewed with a dark color scheme, or in a viewport 400 pixels wide
- THEN every panel MUST remain readable with its figures and citations visible
