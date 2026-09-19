# flow-observability Specification Delta

## MODIFIED Requirements

### Requirement: Cost classes resolve through the spec, and carry allocated spend and hours

A record's cost class SHALL resolve as the session's own class, then the change's `Cost-Class:` trailer,
then the declared class of the spec the change or session cites, then the repository's declared release rule (the
released class for a change a release tag carries, the unreleased class for merged work no tag carries and
for sessions on unmerged pull requests), then the repository's declared default class, else
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

#### Scenario: Work that reaches a tag is released, and every other effort is not

- GIVEN a release rule of `production` for released work and `rd` otherwise
- WHEN a change a release tag carries, a merged change no tag carries, and a session on an unmerged pull
  request are classified
- THEN the first MUST fall under `production` and the other two under `rd`
- AND a spec's declared class MUST still win over the rule
