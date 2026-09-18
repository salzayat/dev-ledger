# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: Subscription cost records are period facts

The system SHALL record what a subscription plan cost as a record of its billing period, not as a field of
any session record. A subscription cost record SHALL declare its schema version, the plan identifier
(matching the `subscriptionId` of the sessions it covers), the period it covers as `YYYY-MM`, the amount
billed for that period, the currency as a three-letter code, and the amount paid in overage beyond the plan,
and SHALL be committed under `.telemetry/subscriptions/<period>/<plan>.json`. The amount SHALL be entered
by the operator through `telemetry subscription record` and SHALL NOT be retrieved from any provider or
platform API. A subscription cost record SHALL reject the same forbidden keys a session record rejects, so
no rate, salary, or compensation figure can enter it. `costUsd` on a subscription session record SHALL
remain zero. `telemetry validate` SHALL validate subscription cost records alongside session records.

#### Scenario: A subscription cost record is written without a network call

- GIVEN a working copy with no platform or provider credential configured
- WHEN an operator records a subscription cost for a period
- THEN the record MUST be written and committed without contacting any service

#### Scenario: A rate cannot enter a subscription cost record

- GIVEN a subscription cost record carrying an `hourlyRate` field
- WHEN it is validated
- THEN validation MUST fail naming the forbidden key

#### Scenario: A subscription session still records no marginal cost

- GIVEN a subscription cost record for a period and a session ending in that period
- WHEN the session record is validated
- THEN its `costUsd` MUST still be required to be zero

## MODIFIED Requirements

### Requirement: Records declare producer and trust class

Every capture record SHALL declare its producer (`harness`, `git`, or `operator`) and its trust class. A
record written by a session hook SHALL be `reported`. A fact read from commit history SHALL be `observed`.
A subscription cost record SHALL be `reported` with producer `operator`. A figure computed by apportioning
an operator-entered amount across records SHALL be `allocated`, and SHALL name the basis it was apportioned
by. A read over the projection SHALL state which trust classes it included, and no read SHALL promote a
`reported` record to `observed`, or an `allocated` figure to either.

#### Scenario: A session record is reported

- GIVEN a session file written by a harness hook
- WHEN the projection is rebuilt
- THEN its token and cost figures MUST carry producer `harness` and trust class `reported`

#### Scenario: A merge time is observed

- GIVEN a merge commit on the default branch
- WHEN the projection is rebuilt
- THEN its committer date MUST carry producer `git` and trust class `observed`

#### Scenario: An apportioned subscription amount is allocated

- GIVEN a subscription cost record for a period and three sessions ending in that period
- WHEN each session's share of the period amount is computed
- THEN each share MUST carry trust class `allocated`
- AND it MUST name the basis it was apportioned by
- AND no read MUST present it as `reported`
