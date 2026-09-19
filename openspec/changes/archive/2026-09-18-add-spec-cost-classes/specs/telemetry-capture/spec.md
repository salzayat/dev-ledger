# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: A spec's cost class is declared once

An operator MAY declare a cost class per spec in a committed file under `.telemetry/`, written by
`telemetry class set <spec> <class>`, validated against the configured class vocabulary and spec pattern,
and rejecting the forbidden keys. `telemetry validate` SHALL cover it.

#### Scenario: A class outside the vocabulary is refused

- GIVEN a vocabulary of `rd` and `production`
- WHEN `class set add-x marketing` runs
- THEN it MUST fail naming the vocabulary
