# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: Transcript token figures are windowed to the session

When a session's token figures are summed from a transcript, only the records timestamped between the
session's start and its end SHALL count, and a record without a timestamp SHALL be left out.
`session figures` SHALL accept the same window as `--from` and `--to`, and without one SHALL count every
record.

#### Scenario: Another session's tokens are not counted

- GIVEN a transcript with usage records before, inside, and after a session's window
- WHEN the session is recorded with that transcript
- THEN its token figures MUST come from the records inside the window alone
