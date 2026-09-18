# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: Reported cost names its currency

A session record MAY carry its reported cost as an amount with a currency rather than in a field naming one.
A record carrying the historical `costUsd` SHALL be read as a cost in USD, so records committed before this
requirement stay valid and are never rewritten. A record carrying both an amount with a currency and
`costUsd` with different values SHALL be rejected. Every read over reported cost SHALL aggregate per
currency and SHALL NOT add amounts in different currencies.

#### Scenario: A historical record is read in USD

- GIVEN a session record carrying `costUsd` and no currency-named amount
- WHEN the projection is rebuilt
- THEN its cost MUST be read as that amount in USD

#### Scenario: Two currencies are never added

- GIVEN two metered sessions reporting costs in different currencies
- WHEN reported spend is requested
- THEN each currency MUST be reported separately
- AND no figure MUST add the two

### Requirement: Cache reads and cache writes are separate measurements

A session record MAY carry cache reads and cache writes as separate figures. A record carrying the
historical combined `cachedTokens` SHALL be read as a combined figure whose components are unknown, and any
read including it SHALL say so. A provider reporting only cache reads SHALL be recorded as having reported
only cache reads and SHALL NOT be recorded as having written zero. Every cache figure SHALL state which
components it covers, and no read SHALL combine a cache denominator across providers.

#### Scenario: Reporting only reads is not reporting zero writes

- GIVEN a harness that reports a cache hit count and no cache write count
- WHEN the session record is written
- THEN it MUST record the reads it reported
- AND it MUST NOT record a cache write count of zero

#### Scenario: A combined historical figure says it is combined

- GIVEN a session record carrying the historical `cachedTokens`
- WHEN a cache figure including it is rendered
- THEN the figure MUST state that the record's components are unknown
