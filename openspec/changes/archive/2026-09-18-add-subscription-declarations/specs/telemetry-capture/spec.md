# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: Plan declarations carry effective-dated amounts

The system SHALL keep a committed plan declaration listing each subscription plan with its identifier, its
provider, its currency, and effective-dated intervals each carrying a unit amount and a seat count. An
interval SHALL state the period from which it holds; intervals for one plan SHALL be ordered and SHALL NOT
overlap, and a change in price or seat count SHALL be expressed by appending an interval rather than by
editing one, so what a plan cost in any period stays readable. A period covered by no interval SHALL be
reported as uncovered and SHALL NOT resolve to the nearest interval. A declaration SHALL reject the same
forbidden keys a session record rejects, so no rate, name, or address can enter it, and SHALL require no
credential and no network.

#### Scenario: A rate change appends an interval

- GIVEN a plan declared at 100 per seat from 2026-01 and at 120 per seat from 2026-07
- WHEN the amount for 2026-06 and for 2026-08 is resolved
- THEN 2026-06 MUST resolve to 100 per seat
- AND 2026-08 MUST resolve to 120 per seat

#### Scenario: Overlapping intervals are rejected

- GIVEN a plan whose intervals both claim to hold from 2026-03
- WHEN the declaration is validated
- THEN validation MUST fail naming the plan and the period

#### Scenario: An uncovered period is named, not guessed

- GIVEN a plan whose earliest interval holds from 2026-06 and a session ending in 2026-03
- WHEN the amount for 2026-03 is resolved
- THEN it MUST be reported as uncovered
- AND it MUST NOT resolve to the 2026-06 interval

### Requirement: A period is closed into records an operator commits

The system SHALL provide a command that writes one subscription cost record per declared plan for a named
period, with the amount computed as the seat count times the unit amount of the interval covering that
period. The command SHALL NOT commit what it writes, so the committed record remains a fact an operator
confirmed rather than one a declaration asserted. It SHALL leave an existing record unchanged unless
overwriting is requested, and SHALL refuse to close a period whose end has not passed unless forced, so an
open month is not recorded as settled.

#### Scenario: Closing a period proposes records without committing

- GIVEN two declared plans and a closed period
- WHEN the period is closed
- THEN one record per plan MUST be written with the amount as seats times unit
- AND nothing MUST be committed

#### Scenario: An existing record is not silently replaced

- GIVEN a period already carrying a record for a declared plan
- WHEN the period is closed without overwriting requested
- THEN that record MUST be left unchanged
- AND the command MUST say what it would have changed

#### Scenario: An open period is not closed by accident

- GIVEN a period whose end has not passed
- WHEN the period is closed without forcing
- THEN the command MUST refuse and name the period
