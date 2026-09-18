# flow-observability Specification Delta

## ADDED Requirements

### Requirement: Configuration may be edited from a local surface that the published page never carries

The system MAY provide a configuration surface served locally against the working copy, editing plan
declarations and subscription cost records and showing the configuration gaps The Board names. It SHALL be
produced by its own command as its own artifact: the page written by `telemetry board --html` SHALL contain
no editing markup whatsoever — no form, no script element, and no control that writes — so a published
deployment cannot be made to reveal an editor, and absence SHALL be by containment rather than by hiding,
disabling, or deciding at runtime. The server SHALL bind the loopback interface only and SHALL refuse to
start when asked to bind another address. It SHALL write only plan declarations and subscription cost
records, SHALL reject a write to any other path, and SHALL NOT edit session records, the projection, or any
record of what happened. It SHALL write to the working copy and SHALL NOT commit, stage, or perform any git
operation. Nothing in the projection, the reads, the published board, or continuous integration SHALL
require it, and the mechanism SHALL behave identically when it is never run.

#### Scenario: The published page carries no editor

- GIVEN a projection with configuration gaps
- WHEN `telemetry board --html` runs
- THEN the written page MUST contain no form, no script element, and no control that writes
- AND it MUST NOT contain editing markup that is hidden, disabled, or enabled at runtime

#### Scenario: The surface is not reachable from another machine

- GIVEN the configuration surface asked to bind an address that is not loopback
- WHEN it starts
- THEN it MUST refuse and name the address

#### Scenario: Only configuration is editable

- GIVEN the configuration surface running against a working copy
- WHEN a write to a session record or to the projection is attempted
- THEN it MUST be refused
- AND only plan declarations and subscription cost records MUST be writable

#### Scenario: Editing leaves history alone

- GIVEN the configuration surface running against a working copy
- WHEN a declaration is edited
- THEN the file MUST change in the working copy
- AND the index and the commit history MUST be unchanged

#### Scenario: The mechanism does not depend on it

- GIVEN an operator who never runs the configuration surface
- WHEN the projection is rebuilt and The Board is rendered
- THEN both MUST behave exactly as they do today
