# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: A harness adapter runs the session lifecycle

The repository SHALL provide a hook adapter for at least one harness that runs `session start` when a
harness session begins and `session end --transcript` when it ends, deriving the model from the
transcript, the plan from the declarations, and the commits from the branch since the recorded start, and
naming the adapter in `figuresSource`. The adapter SHALL need nothing but git and this repository.

#### Scenario: A session ends without anyone remembering

- GIVEN the adapter wired into the harness and a session that made commits
- WHEN the harness session ends
- THEN a session record MUST be written and committed naming those commits
- AND the active session MUST be cleared

### Requirement: Recording a session is atomic and loud

When the record commit fails, `session end` SHALL remove the record it wrote, SHALL leave the session
active, and SHALL print the failing hook's output.

#### Scenario: A failed commit leaves nothing half done

- GIVEN a pre-commit hook that fails
- WHEN `session end` runs
- THEN no record file MUST remain
- AND the session MUST still be active
- AND the hook's message MUST be printed
