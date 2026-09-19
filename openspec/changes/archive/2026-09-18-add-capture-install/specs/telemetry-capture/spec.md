# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: Capture installs into any repository

The capture commands SHALL resolve the tool from their own location and act on the repository they run in.
`scripts/install-capture.sh <repository>` SHALL install capture there without changing that repository's
commit style or checks: hook shims for `prepare-commit-msg` and `pre-push` in its hooks directory, the
operator, plan, and provider in its local git configuration, a `telemetry.config.json` when it has none,
and optionally the harness adapter. An existing hook SHALL be kept, and run first when `--force` installs
over it. A repository whose hooks are routed with `core.hooksPath` SHALL be refused with the lines to add.

#### Scenario: A session is recorded in another repository

- GIVEN capture installed into a repository with an operator and a plan
- WHEN a session is started there, work is committed, and the session is ended
- THEN the work commit and the record commit MUST carry the `Session:` trailer
- AND the record MUST be committed in that repository carrying the operator

#### Scenario: A routed repository is refused

- GIVEN a repository with `core.hooksPath` set
- WHEN capture is installed
- THEN the installer MUST exit with an error and change nothing
