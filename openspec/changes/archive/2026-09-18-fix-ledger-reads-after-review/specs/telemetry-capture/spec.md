# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: The session commands own the session's clock

`telemetry session start` SHALL record the time it was invoked alongside the session identifier, in the same
local git configuration. `telemetry session end` SHALL write `startedAt` from that recorded time and
`endedAt` from its own clock when the payload omits them, SHALL keep a payload's stated times when it states
them, and SHALL clear the recorded start with the identifier. A session file SHALL still carry both times.

#### Scenario: A payload without times gets the commands' clock

- GIVEN `session start` was run and a payload omitting `startedAt` and `endedAt`
- WHEN `session end` records the session
- THEN the file's `startedAt` MUST equal the time `session start` recorded
- AND its `endedAt` MUST be at or after it

#### Scenario: A payload's own times are kept

- GIVEN a payload stating `startedAt` and `endedAt`
- WHEN `session end` records the session
- THEN both MUST be written unchanged
