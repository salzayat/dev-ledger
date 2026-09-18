# workflow-governance Specification Delta

## ADDED Requirements

### Requirement: Contributors are warned when the hooks that run are not the hooks in their tree

The repository SHALL provide a check comparing the hooks git will run — the files under the effective
`core.hooksPath` — with the `.githooks` directory of the current working tree, and SHALL name every hook that
differs or is absent there, together with the directory supplying it. The check SHALL resolve a relative
`core.hooksPath` against the current working tree root, and SHALL exit quietly when the effective path is that
working tree's own `.githooks`. It SHALL report an unset `core.hooksPath` as hooks not installed, and a path
holding none of the repository's hooks as a misconfiguration, each distinctly from drift and each naming its
own remedy. The check SHALL warn without failing, so a stale checkout a contributor does not own cannot block
their commit, and SHALL require no network access. It SHALL NOT modify `core.hooksPath`, any hook, or any
repository or worktree configuration.

#### Scenario: A drifted hook is named

- GIVEN an effective `core.hooksPath` outside the current working tree whose `prepare-commit-msg` differs
  from the working tree's
- WHEN the check runs
- THEN it MUST name `prepare-commit-msg` and the directory supplying it
- AND it MUST exit without failing

#### Scenario: Matching hooks warn about nothing

- GIVEN an effective `core.hooksPath` whose hooks are identical to the working tree's
- WHEN the check runs
- THEN it MUST report no drift

#### Scenario: Hooks that are not installed are named as such

- GIVEN a repository with no `core.hooksPath` configured
- WHEN the check runs
- THEN it MUST report that no hook will run
- AND it MUST name the installer

#### Scenario: The check changes nothing

- GIVEN any configuration of `core.hooksPath`
- WHEN the check runs
- THEN `core.hooksPath` MUST be unchanged
- AND every hook file MUST be unchanged
