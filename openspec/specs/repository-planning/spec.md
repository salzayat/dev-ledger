# repository-planning Specification

## Purpose

Define roadmap sequencing, OpenSpec dependency declarations, and the readiness evidence required before work
can begin.

## Requirements

### Requirement: Roadmap entries establish dependency order

The roadmap MUST list planned capabilities in execution order and link each capability to its governing
OpenSpec change. When a capability depends on another change, the predecessor MUST appear earlier in the
roadmap milestone or in an earlier milestone. A change is dependency-ready only when every listed predecessor
is archived and its required verification evidence is recorded. Every roadmap data row MUST either
reference at least one governing change or state `None` explicitly in its governing-changes cell; a row
with neither MUST fail the roadmap freshness check rather than being silently treated as exempt from every
governing-change rule. The check MUST recognize and skip the table's own GFM header-separator row rather
than relying on that row's shape to satisfy the same fall-through as a genuinely empty cell.

#### Scenario: Later work waits for an unfinished predecessor

- GIVEN a roadmap milestone lists change A before change B
- AND change A has incomplete tasks or is not archived
- WHEN an agent selects the next change
- THEN it selects A rather than B
- AND B is not treated as dependency-ready

#### Scenario: A blank governing-changes cell fails, an explicit None does not

- GIVEN a roadmap row's governing-changes cell is blank
- WHEN the roadmap freshness check runs
- THEN it reports that row as missing a governing change or explicit `None`
- AND a row whose cell states `None` passes without requiring any archived change

### Requirement: OpenSpec changes declare dependencies and readiness

An OpenSpec change that depends on another change MUST include a `## Dependencies` section in its proposal or
design. Each dependency MUST name the governing change and state the concrete readiness condition. A change
with no dependency MUST state `None` so that absence is intentional and reviewable. Per-capability progress
toward resuming or continuing a change MUST be derivable from existing OpenSpec state (task completion and
the change's declared capability) rather than recorded as separate prose that requires its own freshness
check.

#### Scenario: Reviewer can determine whether a change may start

- GIVEN a contributor reviews an OpenSpec proposal
- WHEN the contributor reads its Dependencies section
- THEN the contributor can identify predecessor changes and their readiness conditions
- AND cannot infer readiness solely from roadmap prose

#### Scenario: Agent resumes a capability without full session context

- GIVEN an active OpenSpec change touches a capability under `openspec/specs/`
- WHEN an agent runs the repository's spec status command instead of reading prior session context
- THEN it reports the active change and its task completion for that capability without requiring a
  hand-maintained progress document

### Requirement: Template code marks clone and fork replacement boundaries

The repository MUST use the literal `TEMPLATE:REPLACE` marker for tracked example code that is expected to be
replaced or substantially adapted after a clone or fork. The marker MUST identify the replacement boundary
without changing runtime behavior, and its documentation MUST explain when and how to act on it.

#### Scenario: Fork owner finds the example replacement boundary

- GIVEN a contributor forks the repository to start a domain project
- WHEN the contributor searches tracked implementation and test files for `TEMPLATE:REPLACE`
- THEN the current example implementation and its test fixture identify themselves as replaceable
- AND the contributor can follow linked guidance without deleting the repository governance first

### Requirement: A fork owner has a single ordered onboarding path

The repository MUST provide a root-level guide that gives a fork owner an ordered, checkable sequence for
turning the template into their own project: rename identity strings, replace `TEMPLATE:REPLACE`-marked
example code, run the verification gate, then propose their first domain OpenSpec change. The verification
gate's check of the `TEMPLATE:REPLACE` marker MUST accept both the unforked state (the marker present in
every marked file) and a completed replacement (the marker absent from every file that shared its
replacement unit) as passing; it MUST fail only when files that share a replacement unit disagree on
whether the marker is still present.

#### Scenario: Fork owner follows the guide to a verified, renamed project

- **WHEN** a contributor forks the repository and follows `TEMPLATE.md` in order
- **THEN** `package.json` and `README.md` no longer reference `dev-ledger` or `salzayat/dev-ledger`
- **AND** no tracked file under `packages/` contains a `TEMPLATE:REPLACE` marker
- **AND** `npm run check` passes

#### Scenario: Marker search covers every teaching example, not just the first one

- **WHEN** a contributor searches tracked implementation and test files for `TEMPLATE:REPLACE`
- **THEN** both `packages/hello` and `packages/greeter` implementation and test files are found

#### Scenario: A half-finished replacement fails, a completed one does not

- **GIVEN** `packages/hello`'s implementation and test share one replacement unit
- **WHEN** only one of the two still carries the `TEMPLATE:REPLACE` marker
- **THEN** the verification gate fails with a message naming the disagreement
- **AND** the gate passes once both files agree, whether that means both still carry the marker or neither
  does
