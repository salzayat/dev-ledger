# workflow-governance Specification Delta

## MODIFIED Requirements

### Requirement: Continuous integration refuses undeclared work

The check workflow, which runs on every pull request, SHALL fail a pull request whose commits relative to the base carry no `Session:`
trailer and whose body neither names a session nor carries `Session: undeclared`, and SHALL print the same
three ways forward the PR helper prints. `scripts/pr.sh --allow-undeclared` SHALL write
`Session: undeclared` into the body so the override is visible to the workflow.

#### Scenario: An undeclared pull request fails the build

- GIVEN a pull request with no `Session:` trailer on its commits and none in its body
- WHEN the check workflow runs
- THEN the declared check MUST fail naming the three ways forward

#### Scenario: An explicit override passes

- GIVEN a pull request whose body carries `Session: undeclared`
- WHEN the check workflow runs
- THEN the declared check MUST pass and say the work is undeclared on purpose
