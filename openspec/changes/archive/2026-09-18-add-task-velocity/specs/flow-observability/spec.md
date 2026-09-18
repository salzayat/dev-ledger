# flow-observability Specification Delta

## MODIFIED Requirements

### Requirement: Velocity per week

The projection SHALL report velocity over the measured window as the relative complexity of OpenSpec tasks
completed per week, read from each change's task list: a task line MAY carry a weight as `~N` after its
identifier, a completed task is one ticked at the change's last commit and not at its base, keyed by change
name so that archiving a list completes nothing, and an unweighted task SHALL count one and be reported as
unweighted rather than guessed. Tasks per week, changes per week, and story points per week where recorded
SHALL sit beside it, and changes recording no points SHALL be excluded from the points figure with their
count stated. It SHALL be available per repository and across the registry, SHALL state the trust classes
it included, and The Ledger SHALL render it in the flow tab with its trend as inline SVG. No velocity figure
SHALL be keyed to an operator or to any person.

#### Scenario: Velocity excludes what it cannot measure

- GIVEN a window of ten merged changes of which four recorded story points
- WHEN velocity is computed
- THEN the points figure MUST be computed over those four only
- AND it MUST report that six were excluded for recording no points
- AND it MUST NOT count them as zero points

#### Scenario: Velocity is not keyed to a person

- GIVEN a projection whose session records carry operator identifiers
- WHEN velocity is computed
- THEN it MUST NOT group, rank, or trend by operator or by person

#### Scenario: Complexity comes from the tasks a change ticked

- GIVEN a change that ticks a `~3` task and a `~5` task, and a later change that ticks an unweighted task
- WHEN velocity is computed
- THEN the window MUST report three tasks and a complexity of nine
- AND one task MUST be reported as unweighted

#### Scenario: Archiving a task list completes nothing

- GIVEN a change that moves a fully ticked task list into the archive
- WHEN its completed tasks are read
- THEN it MUST complete none
