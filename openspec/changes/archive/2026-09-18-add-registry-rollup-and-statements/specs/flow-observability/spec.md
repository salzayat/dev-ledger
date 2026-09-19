# flow-observability Specification Delta

## ADDED Requirements

### Requirement: The registry rollup and the period statement

The projection SHALL carry a rollup across every reachable repository: spend by spec and by cost class with
reported and allocated apart, hours by operator, and velocity, each row naming its repositories. The Ledger
SHALL render it when more than one repository is registered. `telemetry export --period YYYY-MM` SHALL
write a statement as CSV or JSON rows, each carrying its trust class and whether it is a period fact
(allocations, hours, timesheets) or a window fact (classes, specs, velocity).

#### Scenario: A spec across two repositories is one row

- GIVEN two repositories whose changes cite the same spec with $10 allocated each
- WHEN the rollup is computed
- THEN that spec MUST read $20 allocated, naming both repositories

#### Scenario: A statement carries the month's facts

- GIVEN a period with one allocation per repository and measured hours for an operator
- WHEN the statement is exported
- THEN it MUST carry one allocation row per repository and the operator's hours as period rows
- AND a month with nothing MUST carry no period rows
