# Add Timesheets

## Why

Operator hours exist per session and nowhere else. A retainer needs them per spec, per month, and
confirmed by the person who worked them, the way a period's subscription cost is proposed by the tool and
confirmed by a commit. The measurement is a heuristic over prompt timing, named on every record; an invoice
needs a figure someone stood behind.

## What Changes

- Hours by operator, by spec, and by month, from every record's operator active seconds, on the spend tab.
- A timesheet record per operator and period under `.telemetry/timesheets/`, proposed by
  `telemetry timesheet close <YYYY-MM>` from the period's session records, with measured hours by spec
  kept beside the confirmed ones. The command writes and stops; the operator edits and commits. It refuses
  an open period without `--force` and an existing sheet without `--overwrite`.
- The hours panel shows measured beside confirmed per operator and month, with the sheet cited, and the
  specs each operator's hours went to.

## Dependencies

`add-spec-cost-classes`.

## Non-Goals

- No rate and no money on a timesheet. Hours stay hours.
- No name on a timesheet; the operator is the pseudonymous identifier the configuration declares.
