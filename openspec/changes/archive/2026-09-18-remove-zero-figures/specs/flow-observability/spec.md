# flow-observability Specification Delta

## ADDED Requirements

### Requirement: A zero on The Ledger is a measurement, never an absence

The Ledger SHALL NOT render a currency figure of zero where no cost was reported: a reported cost whose
contributing sessions were all subscription sessions SHALL read as none reported with the token figures
leading, and spend over time SHALL lead with the allocated share when nothing was reported, badged as
allocated. Hours not yet confirmed, exclusions that did not occur, and effort units no change recorded
SHALL read as absence in words. A measured zero, such as no escapes after a release, SHALL read as none.

#### Scenario: A subscription repository shows no currency zero

- GIVEN a repository whose every session is a subscription session with a period record
- WHEN The Ledger is rendered
- THEN no panel MUST render `$0.00`
- AND the spend-over-time chart MUST show the allocated share per week, badged allocated
