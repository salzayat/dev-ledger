# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: Operator hours are attributed within the session window

When a session's operator hours are read from a transcript, only the transcript events between the
session's recorded start and its end SHALL be attributed, so a transcript shared across sessions never
charges one session another's hours. A payload stating its own hours SHALL keep them. When cost allocation
is enabled and no operator identifier is configured, `session end` SHALL record the hours without an
identifier and SHALL print how to configure one.

#### Scenario: Events outside the window do not count

- GIVEN a transcript with prompts an hour apart before the session started and ten minutes apart inside it
- WHEN the session is recorded with that transcript
- THEN its operator hours MUST come from the ten minutes inside the window alone

#### Scenario: No identifier is a warning, not a lost measurement

- GIVEN cost allocation enabled and no `telemetry.operator` configured
- WHEN a session is recorded
- THEN the record MUST carry its hours with a null identifier
- AND the command MUST print the configuration command that sets one
