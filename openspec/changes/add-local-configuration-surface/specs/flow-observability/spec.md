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

## MODIFIED Requirements

### Requirement: Subscription configuration is reported on the local surface, not the published page

The projection SHALL collect subscription configuration gaps: a declared plan with no cost record for a
period that has closed, a cost record for a plan no declaration covers, a session naming a subscription
identifier no cost record covers, and a period no interval of a plan's declaration covers. Each gap SHALL
name the plan or session it concerns, SHALL cite the records behind it, and SHALL name the command that
closes it.

The gaps SHALL be rendered on the locally served configuration surface and SHALL NOT appear on the page
written by `telemetry ledger --html`. What is withheld is the configuration itself — the declarations, the
gaps between them and the records, the remedies that name files to edit, and any control that writes — not
the spend the ledger exists to publish: the allocation panel SHALL keep naming the plan and citing the cost
record its figures came from, because that is the record behind a published figure rather than a setting.
Absence SHALL be by containment rather than by hiding or disabling, so a deployment cannot be made to reveal
an editor it never held. The terminal render, which runs where the operator already is, MAY report the gaps.

#### Scenario: A closed period with no record is a named gap

- GIVEN a declared plan and a period that has closed with no cost record for it
- WHEN an operator opens the local configuration surface
- THEN that plan and period MUST be named as a gap
- AND the gap MUST name the command that writes the record

#### Scenario: A session naming an unknown plan is named, not only counted

- GIVEN a session whose subscription identifier matches no cost record
- WHEN an operator opens the local configuration surface
- THEN that session MUST be named against the identifier it expected
- AND it MUST still be counted in the allocation's excluded count

#### Scenario: The configuration panel changes nothing

- GIVEN a projection with configuration gaps
- WHEN `telemetry ledger --html` runs
- THEN the written page MUST contain no configuration panel, no gap, and no remedy naming a file to edit
- AND it MUST contain no script element, no external resource, and no form
- AND it MUST contain no control that writes a declaration or a record
