# flow-observability Specification Delta

## REMOVED Requirements

### Requirement: Cost classes resolve through the spec, and carry allocated spend and hours

**Reason**: Its release rule called merged work without a tag R&D; the ship states replace it, and pending
work waits for the next tag instead.

**Migration**: Replaced by "Cost classes resolve through the spec and the ship state, and carry allocated
spend and hours". Declare the rule as `{ shipped, discarded }` with `telemetry class set --release`.

## ADDED Requirements

### Requirement: Cost classes resolve through the spec and the ship state, and carry allocated spend and hours

A record's cost class SHALL resolve as the session's own class, then the change's `Cost-Class:` trailer,
then the declared class of the spec the change or session cites, then the repository's declared release rule (the
shipped class for shipped work, the discarded class for discarded work, and a `pending` row, resolved by
`pending`, for pending work), then the repository's declared default class, else
`unclassified`; nothing SHALL be inferred. Sessions on unmerged pull requests SHALL be classified too. Spend by class SHALL report reported cost, allocated spend in its currency, operator hours, and
how many records resolved by each source. Flow efficiency SHALL report active time outside any change's
window by spec.

#### Scenario: A spec declaration classifies a session that declares nothing

- GIVEN a spec declared `rd` and a session citing it with no class of its own
- WHEN spend by class is computed
- THEN that session's figures MUST fall under `rd`, resolved by the spec

#### Scenario: A session's own class wins

- GIVEN a spec declared `rd` and a session citing it that carries `production`
- WHEN spend by class is computed
- THEN that session MUST fall under `production`

#### Scenario: The declared default covers work nothing else classifies

- GIVEN a repository declaring a default class of `rd` and a spec declared `production`
- WHEN a session citing that spec and a session citing no spec are classified
- THEN the first MUST fall under `production`, resolved by the spec
- AND the second MUST fall under `rd`, resolved by the default

#### Scenario: The release rule classifies by where the work ended

- GIVEN a release rule of `production` for shipped work and `rd` for discarded work
- WHEN a shipped change, a change a later change overwrote before the tag, a pull request declared closed,
  a change merged after the last tag, and an open pull request are classified
- THEN the first MUST fall under `production`, the next two under `rd`, and the last two under `pending`
- AND a spec's declared class MUST still win over the rule

### Requirement: Every change and pull request is shipped, pending, or discarded

The projection SHALL place every measured change and every unmerged pull request in one state, from git and
the registry alone. A change SHALL be `shipped` when a release tag carries it and blame at the first tag
carrying it still attributes to it at least one line it added, or it added no lines outside the rework
ignore list. It SHALL be `discarded` when a tag carries it and none of the lines it added survive to that
tag, and `pending` while no tag carries it. An unmerged pull request SHALL be `discarded` when the registry
declares it closed and `pending` otherwise. For each state the projection SHALL report the changes, the
pull requests, reported cost, allocated spend, operator hours, and records without figures. For each
release it SHALL report the changes it first carried that shipped and that were discarded, the lines they
added, and the lines of those still in the tag.

#### Scenario: An attempt overwritten before the tag is discarded

- GIVEN a merged change adding a file, and a later merged change rewriting every line of it, both before a
  release tag
- WHEN the projection is built
- THEN the first change MUST be `discarded` and the second `shipped`
- AND the release MUST report more lines added than lines in the tag

#### Scenario: Work since the last tag is pending

- GIVEN a change merged after the last release tag and an open pull request
- WHEN the projection is built
- THEN both MUST be `pending`

#### Scenario: A closed pull request is discarded

- GIVEN an unmerged pull request the registry declares closed
- WHEN the projection is built
- THEN it MUST be `discarded`
