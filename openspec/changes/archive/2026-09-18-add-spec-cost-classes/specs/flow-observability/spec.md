# flow-observability Specification Delta

## ADDED Requirements

### Requirement: Cost classes resolve through the spec, and carry allocated spend and hours

A record's cost class SHALL resolve as the session's own class, then the change's `Cost-Class:` trailer,
then the declared class of the spec the change or session cites, else `unclassified`; nothing SHALL be
defaulted. Spend by class SHALL report reported cost, allocated spend in its currency, operator hours, and
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
