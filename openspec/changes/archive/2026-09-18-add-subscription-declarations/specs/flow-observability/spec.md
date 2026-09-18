# flow-observability Specification Delta

## ADDED Requirements

### Requirement: The Board reports subscription configuration gaps

The projection SHALL collect subscription configuration gaps and The Board SHALL render them: a declared
plan with no cost record for a period that has closed, a cost record for a plan no declaration covers, a
session naming a subscription identifier no cost record covers, and a period no interval of a plan's
declaration covers. Each gap SHALL name the plan or session it concerns, SHALL cite the records behind it,
and SHALL name the command that closes it. The Board SHALL report these gaps and SHALL NOT change any
configuration: it reads only from the projection, its page carries no script element, no external resource,
and no form, and nothing it renders writes a declaration or a record.

#### Scenario: A closed period with no record is a named gap

- GIVEN a declared plan and a period that has closed with no cost record for it
- WHEN an operator opens The Board
- THEN that plan and period MUST be named as a gap
- AND the gap MUST name the command that writes the record

#### Scenario: A session naming an unknown plan is named, not only counted

- GIVEN a session whose subscription identifier matches no cost record
- WHEN an operator opens The Board
- THEN that session MUST be named against the identifier it expected
- AND it MUST still be counted in the allocation's excluded count

#### Scenario: The configuration panel changes nothing

- GIVEN a projection with configuration gaps
- WHEN `telemetry board --html` runs
- THEN the written page MUST contain no script element, no external resource, and no form
- AND it MUST contain no control that writes a declaration or a record
