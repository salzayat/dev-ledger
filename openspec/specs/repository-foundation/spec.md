# Repository Foundation

## Purpose

The repository provides a small, deterministic starting point for spec-driven Nx projects, whose first
domain packages are `capture` and `flow`.

## Requirements

### Requirement: A new contributor can verify the workspace

The repository MUST document and expose commands for formatting, type checking, linting, testing,
and building the example project. Documentation of the `build` command MUST accurately describe what it
emits; if a package is source-only (declaring only a private, in-workspace consumption condition in its
`exports` map, with no entry that resolves outside this workspace), that MUST be stated rather than implied
to produce a standard consumable package.

#### Scenario: Run the standard quality gates

- **WHEN** a contributor runs the documented verification commands after `npm ci`
- **THEN** each command completes successfully without network access or credentials

#### Scenario: A package's exports map only names conditions that actually resolve

- **GIVEN** `packages/capture` or `packages/flow`'s `package.json`
- **WHEN** a contributor inspects its `exports` map
- **THEN** every entry resolves to a real path produced by that package's own `build` target or its source
  tree
- **AND** no entry names a path the build does not produce

### Requirement: Capture validates its inputs

The `capture` package MUST expose typed functions with explicit behavior for valid and invalid input:
`validateSessionFile` returns an empty list for a valid session file and names every violated field
otherwise, and `validateMessage` returns an empty list for a commit message whose subject and trailers
satisfy the configuration and names every violation otherwise.

#### Scenario: Validating a session file

- **WHEN** `validateSessionFile` receives a well-formed session file and the repository configuration
- **THEN** it returns an empty list

#### Scenario: Rejecting a malformed session file

- **WHEN** `validateSessionFile` receives a session file with a negative token count
- **THEN** it returns a list naming that field rather than an ambiguous result

### Requirement: Flow depends on capture through the workspace

The repository MUST provide the `flow` package, which depends on the `capture` package's typed exports
(trailer parsing, the session schema, the configuration reader), declared as both an npm workspace
dependency and an Nx implicit dependency, so project-boundary and dependency-sequencing conventions are
demonstrated in working code rather than described only in prose.

#### Scenario: Composing a dependent package

- **WHEN** `flow` rebuilds a projection from a mirror
- **THEN** it reads trailers and session files through `capture`'s exports resolved by the
  `@dev-ledger/source` condition, with no build step

#### Scenario: Verifying the workspace covers both packages

- **WHEN** a contributor runs the documented verification commands after `npm ci`
- **THEN** both `capture` and `flow` build, typecheck, lint, and test successfully without network access
  or credentials
