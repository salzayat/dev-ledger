# telemetry-capture Specification Delta

## MODIFIED Requirements

### Requirement: Spec, session, change, and effort trailers on every commit

The repository SHALL define `Spec:` (an OpenSpec change name or a configured identifier pattern),
`Session:` (the active session identifier, or `none` declaring that the work carried no agent session),
`Change:` (an identifier generated once per branch and kept in the local git configuration, so commits from
one branch group into one change after a rebase), effort trailers from the configured vocabulary, and, when
cost allocation is enabled, `Cost-Class:` from the configured cost-class vocabulary. `none` SHALL be written
only from a declaration an operator has made for the branch, and SHALL NOT be written because no session is
active: when no session is active and no such declaration has been made, the `prepare-commit-msg` hook SHALL
write no `Session:` trailer, so the change is classified `undeclared` rather than declared human-only. The
`prepare-commit-msg` hook SHALL write the trailers on each commit from values `scripts/pr.sh` stores in the
branch's local git configuration. The `commit-msg` hook SHALL validate the trailers against the
configuration, SHALL accept a message carrying no `Session:` trailer, and SHALL reject a subject over 100
characters, since a squash or merge commit subject is what the projection reads first. `scripts/pr.sh` SHALL
write the distinct `Spec:` and `Session:` values at the end of the pull request description, so the
recommended "title and description" merge message setting carries them onto a squash or merge commit. A
disabled effort unit SHALL be rejected by the `commit-msg` hook rather than ignored.

#### Scenario: The commit hook writes the trailers

- GIVEN a branch whose local git configuration names a spec, a session, and a change identifier
- WHEN a commit is made through the hooks
- THEN its message MUST end with `Spec:`, `Session:`, and `Change:` trailers carrying those values

#### Scenario: No active session writes no session trailer

- GIVEN a branch with no active session and no human-only declaration
- WHEN a commit is made through the hooks
- THEN its message MUST carry no `Session:` trailer
- AND the projection MUST classify its change `undeclared`

#### Scenario: A commit after a session ends is undeclared, not human-only

- GIVEN a branch on which `telemetry session end` has recorded a session and unset the active session
- WHEN a further commit is made on that branch through the hooks
- THEN its message MUST carry no `Session:` trailer
- AND it MUST NOT be recorded as declared human-only work

#### Scenario: Human-only work is declared deliberately

- GIVEN a branch for which an operator has declared that the work carries no agent session
- WHEN a commit is made through the hooks
- THEN its message MUST carry `Session: none`
- AND the projection MUST classify its change neither `undeclared` nor `unreported`

#### Scenario: An over-long subject is rejected

- GIVEN a commit whose subject exceeds 100 characters
- WHEN the `commit-msg` hook runs
- THEN it MUST fail and name the length

#### Scenario: A disabled effort unit is rejected

- GIVEN a configuration in which story points are disabled
- WHEN a commit message carries a `Story-Points:` trailer
- THEN the `commit-msg` hook MUST fail and name the disabled unit

#### Scenario: PR creation writes the spec reference

- GIVEN an operator creates a pull request through `scripts/pr.sh` on a branch whose change name is known
- WHEN the pull request is created
- THEN its description MUST end with a `Spec:` trailer naming that change
