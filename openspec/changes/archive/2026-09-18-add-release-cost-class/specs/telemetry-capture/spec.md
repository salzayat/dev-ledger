# telemetry-capture Specification Delta

## MODIFIED Requirements

### Requirement: A spec's cost class is declared once

An operator MAY declare a cost class per spec in a committed file under `.telemetry/`, written by
`telemetry class set <spec> <class>`, and MAY declare a default class for the
repository's other work with `telemetry class set --default <class>`, and a release rule with
`telemetry class set --release <released-class> <unreleased-class>`, each validated against the configured class vocabulary and spec pattern,
and rejecting the forbidden keys. `telemetry validate` SHALL cover it.

#### Scenario: A class outside the vocabulary is refused

- GIVEN a vocabulary of `rd` and `production`
- WHEN `class set add-x marketing` runs
- THEN it MUST fail naming the vocabulary

#### Scenario: A default outside the vocabulary is refused

- GIVEN a vocabulary of `rd` and `production`
- WHEN `class set --default marketing` runs
- THEN it MUST fail naming the vocabulary

#### Scenario: A release rule outside the vocabulary is refused

- GIVEN a vocabulary of `rd` and `production`
- WHEN `class set --release production marketing` runs
- THEN it MUST fail naming the vocabulary
