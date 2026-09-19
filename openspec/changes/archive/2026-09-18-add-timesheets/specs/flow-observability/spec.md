# flow-observability Specification Delta

## ADDED Requirements

### Requirement: Hours by operator, spec, and month, measured beside confirmed

The projection SHALL report operator hours by operator, by spec, and by month from each record's operator
active seconds, and SHALL carry, per operator and month, the confirmed hours from a committed timesheet
beside the measured ones, citing the sheet. No read SHALL multiply hours by anything. The Ledger SHALL
render the panel on the spend tab.

#### Scenario: A confirmed month sits beside its measurement

- GIVEN records measuring 2.0 hours for an operator in a month and a committed timesheet confirming 1.5
- WHEN hours are computed
- THEN that operator's month MUST read 2.0 measured and 1.5 confirmed, citing the sheet
