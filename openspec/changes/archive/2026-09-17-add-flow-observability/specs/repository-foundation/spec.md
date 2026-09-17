# repository-foundation Specification Delta

The template's teaching examples (`hello` and `greeter`) are replaced by the first domain packages,
`capture` and `flow`. This delta was drafted with the change but fell out of the pull request stack; it was
applied to the accepted spec by hand at archive time (see the archive pull request).

## REMOVED Requirements

### Requirement: Example logic has a direct contract

**Reason**: `packages/hello` and its `greet` example were replaced by the `capture` package.
**Migration**: "Capture validates its inputs" covers the same property for the real package.

### Requirement: A second package demonstrates inter-package dependency

**Reason**: `packages/greeter` and its `announce` example were replaced by the `flow` package.
**Migration**: "Flow depends on capture through the workspace" covers the same property.

## ADDED Requirements

### Requirement: Capture validates its inputs

See the accepted `repository-foundation` spec.

#### Scenario: Validating a session file

- **WHEN** `validateSessionFile` receives a well-formed session file and the repository configuration
- **THEN** it returns an empty list

### Requirement: Flow depends on capture through the workspace

See the accepted `repository-foundation` spec.

#### Scenario: Composing a dependent package

- **WHEN** `flow` rebuilds a projection from a mirror
- **THEN** it reads trailers and session files through `capture`'s exports with no build step
