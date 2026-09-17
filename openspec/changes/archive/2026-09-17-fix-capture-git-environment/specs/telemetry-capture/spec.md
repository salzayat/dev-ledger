# telemetry-capture Specification Delta

## ADDED Requirements

### Requirement: Git children never inherit the caller's index or repository

Every git child process this repository's packages run SHALL be given an environment with the inherited git
variables removed — `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_WORK_TREE`, `GIT_OBJECT_DIRECTORY`,
`GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_PREFIX`, and `GIT_COMMON_DIR` — so a command acts on the
repository it was given and never on the caller's. A command invoked from a git hook, where those variables
are exported, SHALL behave exactly as it does when invoked from a shell.

#### Scenario: A command invoked from a hook acts on its own repository

- GIVEN `GIT_INDEX_FILE` and `GIT_DIR` are exported and name another repository
- WHEN a capture command runs against a working copy
- THEN it MUST read and write that working copy's own repository
- AND it MUST NOT add an entry to the exported index
