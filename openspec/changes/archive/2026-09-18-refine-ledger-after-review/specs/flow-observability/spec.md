# flow-observability Specification Delta

## ADDED Requirements

### Requirement: The registry declares where measurement starts and what git cannot see

A registry entry MAY declare `measuredFrom`, an instant before which merged changes predate the
instrumentation: the projection SHALL still record those changes and SHALL exclude them from every signal
with their count stated under that reason, so coverage counts only the period the tool was present for. A
registry entry MAY declare `closedPullRequests`: an unmerged pull head so declared SHALL leave the queue,
and the signals SHALL list the numbers so declared.

#### Scenario: Changes before measuredFrom are excluded by reason

- GIVEN two changes merged before `measuredFrom` and one after
- WHEN the signals are computed
- THEN coverage MUST count one change
- AND the boundary MUST report two changes before measurement
- AND the projection MUST still record all three

#### Scenario: A declared closed pull request leaves the queue

- GIVEN two unmerged pull heads of which one is declared closed
- WHEN the queue is computed
- THEN it MUST list the other alone
- AND the boundary MUST name the declared one

### Requirement: Operator notes are records beside the figures they explain

An operator MAY record a note naming a read and optionally a period, with text and a timestamp, under
`.telemetry/notes/`, written by `telemetry note add` and committed. A note SHALL be validated like every
other record, SHALL reject the forbidden keys, SHALL be read from the default branch into the projection,
and SHALL be rendered on The Ledger dated and citing its file. A note SHALL explain a figure and SHALL
NOT change one.

#### Scenario: A note renders with its cite

- GIVEN a committed note on `coverage`
- WHEN The Ledger is rendered
- THEN the records tab MUST show the note's text, its date, and a cite to its file

### Requirement: Flow efficiency and spec lead time measure the change, not the process

Flow efficiency SHALL count, per change, only the active seconds whose session window overlaps the
change's cycle window, spreading a session's active time evenly over its own window, SHALL report the
remainder as worked outside the window, and SHALL NOT exceed one. Spec lead time SHALL start at the
earlier of the first commit carrying the `Spec:` reference and the first appearance of the change's
`openspec/changes/<name>/proposal.md`.

#### Scenario: Active time outside the window is reported apart

- GIVEN a change with a one-hour cycle and a session of 1,200 active seconds whose window covers the hour
  before the first commit and the hour after it
- WHEN flow efficiency is computed
- THEN the change's value MUST count about 600 seconds
- AND about 600 seconds MUST be reported as worked outside the window

#### Scenario: Spec lead time starts at the proposal

- GIVEN a proposal file merged a day before the first commit carrying its `Spec:` reference
- WHEN spec lead time is computed
- THEN the interval MUST start at the proposal's first commit
