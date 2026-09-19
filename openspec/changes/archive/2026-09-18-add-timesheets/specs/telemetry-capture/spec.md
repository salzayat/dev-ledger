# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: A period's hours are confirmed by a timesheet

`telemetry timesheet close <YYYY-MM>` SHALL propose one timesheet per declared operator from the session
records that ended in the period, carrying hours by spec as measured and the same figures as the confirmed
column to be edited, SHALL write them under `.telemetry/timesheets/<period>/` without committing, SHALL
refuse a period whose end has not passed without `--force`, and SHALL leave an existing sheet alone
without `--overwrite`. A timesheet SHALL name a declared operator, SHALL carry no rate and no name, and
SHALL be validated by `telemetry validate`.

#### Scenario: Close proposes and stops

- GIVEN two records in September for one operator, one citing a spec and one citing none
- WHEN `timesheet close 2026-09` runs
- THEN one sheet MUST be written with hours by spec and `(none)`, measured equal to confirmed
- AND nothing MUST be committed
