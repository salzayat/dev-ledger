# workflow-governance Specification Delta

## ADDED Requirements

### Requirement: A pull request is not opened undeclared by accident

The PR automation SHALL refuse to open a pull request when no session is active, the branch carries no
human-only declaration, and no commit on the branch relative to its base carries a `Session:` trailer. The
refusal SHALL name the three ways forward: starting a session, declaring the branch human-only, or passing
an explicit `--allow-undeclared` override, which SHALL open the pull request with its commits undeclared.

#### Scenario: No session and no declaration

- GIVEN a branch with no active session, no human-only declaration, and no `Session:` trailer on its commits
- WHEN the PR helper is run without `--allow-undeclared`
- THEN it MUST refuse before staging anything
- AND its message MUST name `session start`, `--human-only`, and `--allow-undeclared`

#### Scenario: A prior session on the branch suffices

- GIVEN a branch whose earlier commit carries a `Session:` trailer and no session active now
- WHEN the PR helper is run
- THEN it MUST proceed
