# ci-governance Specification Delta

## RENAMED Requirements

- FROM: `### Requirement: The Board is built on every pull request and published only from the default branch`
- TO: `### Requirement: The Ledger is built on every pull request and published only from the default branch`

## MODIFIED Requirements

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
