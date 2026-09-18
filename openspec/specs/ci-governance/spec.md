# ci-governance Specification

## Purpose

Define how dependency-update automation participates in documentation and quality gates without weakening
checks for human-authored changes.

## Requirements

### Requirement: Dependabot-only version updates do not fail documentation freshness

The CI quality workflow MUST identify Dependabot-triggered runs explicitly. The documentation freshness check
MAY suppress only its documentation-presence failure for such a run when no documentation file is included.
All other quality gates MUST continue to run, and local or human-authored changes MUST retain the existing
documentation requirement.

#### Scenario: Dependabot version update proceeds to quality gates

- GIVEN a Dependabot pull request changes dependency versions without documentation
- WHEN the CI quality workflow runs
- THEN documentation freshness does not fail solely because no docs file changed
- AND secret, OpenSpec, harness, formatting, lint, typecheck, test, and build checks still run

#### Scenario: Human dependency change still requires documentation

- GIVEN a human-authored change modifies dependency or workflow files without documentation
- WHEN the local or CI documentation freshness check runs without the Dependabot indicator
- THEN it fails with the existing actionable documentation message

### Requirement: Dependency advisories are reviewed, not silently ignored

The repository MUST maintain a record of accepted dependency advisories with no available non-regressive
fix, naming each advisory's id and the reason it is accepted. A CI check MUST compare the dependency
scanner's findings against that record and fail when a finding is not present in it, so a new, unreviewed
advisory cannot land without at least one recorded decision. This check requires network access to the
package registry and therefore runs only in CI, not in the local, offline quality gate.

#### Scenario: An already-reviewed advisory does not fail CI

- GIVEN a dependency advisory is recorded in the accepted-advisories document with its id and rationale
- WHEN the dependency advisory check runs and the scanner reports that same advisory
- THEN the check passes

#### Scenario: A new, unreviewed advisory fails CI

- GIVEN a dependency advisory scan reports an advisory id not present in the accepted-advisories document
- WHEN the dependency advisory check runs
- THEN it fails and names the unreviewed advisory id

### Requirement: The Ledger is built on every pull request and published only from the default branch

The continuous integration workflow SHALL build The Ledger's static HTML page on every pull request and on
every push to the default branch, checking out the full history so the projection matches one an operator
rebuilds locally. On a pull request it SHALL make the page available as a run artifact and write the terminal
render into the run's job summary, and SHALL NOT deploy. On the default branch it SHALL deploy the page to
the repository's pages site, and that deployment SHALL be gated on the repository not being private, so the
workflow may be merged while the repository is private without publishing anything. Deployments SHALL be
serialized so that two merges cannot race the single site. The workflow SHALL NOT commit the generated page
to the repository, SHALL NOT use a pull-request trigger that grants a fork's branch access to repository
secrets, and SHALL use no credential other than the one the platform issues to the run.

#### Scenario: A pull request builds the board without publishing

- GIVEN a pull request that changes the projection or the page
- WHEN the board workflow runs
- THEN the page MUST be uploaded as a run artifact
- AND the terminal render MUST appear in the run's job summary
- AND no deployment MUST occur

#### Scenario: A private repository publishes nothing

- GIVEN the repository is private
- WHEN the board workflow runs on the default branch
- THEN the deploy job MUST be skipped
- AND no page MUST be published

#### Scenario: A public repository publishes from the default branch

- GIVEN the repository is public
- WHEN a change merges to the default branch
- THEN the page MUST be deployed to the repository's pages site

#### Scenario: Concurrent merges do not race the site

- GIVEN two changes merging to the default branch within one deployment's duration
- WHEN both runs reach the deploy job
- THEN the deployments MUST be serialized rather than run concurrently

#### Scenario: The workflow adds no secret and commits no page

- GIVEN the board workflow
- WHEN it is inspected
- THEN it MUST reference no repository secret for the board build
- AND it MUST NOT use a pull-request trigger granting a fork's branch access to secrets
- AND no run MUST commit a generated page to the repository
