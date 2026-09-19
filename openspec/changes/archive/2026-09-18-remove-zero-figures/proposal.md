# Remove Zero Figures

## Why

The page printed a zero in fourteen places, and only one was a measurement: no escapes after the release.
The rest were structural: reported cost on a subscription, confirmed hours before any timesheet, effort
units nobody recorded, exclusion counts of zero. A zero reads as a figure, and these were absences.

## What Changes

- Reported cost reads "none reported" wherever every contributing session was a subscription session, in
  the strip, the spend panel, every spend table, the class panel, the queue, and the changes table; token
  figures lead instead.
- Spend over time leads with allocated spend when nothing was reported, and says so on the badge; the
  weekly buckets carry the allocated share.
- Confirmed hours read "none confirmed by a timesheet yet"; escapes read "none"; the queue reads "none older
  than"; exclusion lines omit counts of zero; effort units with no change read "none"; an allocated per-unit
  figure under a cent shows four places instead of rounding to nothing.

## Dependencies

`add-registry-rollup-and-statements`.

## Non-Goals

- No change to the projection's numbers. A zero that is a measurement (no escapes) still counts as zero in
  the data; only its rendering changes.
