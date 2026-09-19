# Add Registry Rollup And Statements

## Why

The accepted contract says every read is available per repository and across the registry, and the page
renders repositories one at a time: a spec that spans two repositories is two rows on two pages, and a
team's total is arithmetic the reader does by hand. And nothing writes the document finance or a client
asks for: the figures for one month, as rows a spreadsheet can take.

## What Changes

- The projection carries a registry rollup: spend by spec and by class (reported and allocated apart),
  hours by operator, and velocity, summed across every reachable repository. The Ledger renders an
  "All repositories" section when there is more than one.
- `telemetry export --period YYYY-MM [--format csv|json] [--output path]` writes a period statement from
  the projection: the period's allocations, measured and confirmed hours per operator, and, marked as
  window-scoped, spend by class and by spec and velocity, every row carrying its trust class.

## Dependencies

`add-timesheets`.

## Non-Goals

- No new capture. The rollup and the statement are reads over what the projection already holds.
- No invoice formatting or rates; the statement carries hours and currency in separate rows.
