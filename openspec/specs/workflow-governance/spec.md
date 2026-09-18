# workflow-governance Specification

## Purpose

Govern the executable parts of the contribution workflow: PR automation must pass body content literally
and dependency updates must be checked for readiness before merge, so contributors and agents get the same
guardrails whether they run `scripts/pr.sh` by hand or through an agent command.

## Requirements

### Requirement: PR automation preserves literal body content

The PR automation MUST support reading a pull-request body from an explicit file path and MUST pass its
contents literally, including Markdown backticks and OpenSpec change names. It MAY append generated
blocks — the telemetry section and the trailer block — to that body, and MUST NOT rewrite, reorder, or
remove any supplied line when it does; each appended block MUST be delimited so a reader can tell it
from the supplied text. Inline body input and file body
input MUST be mutually exclusive. A missing or unreadable body file MUST fail before commit or push. The
generated default body MUST be built with a mechanism (such as `printf`-style templating) that treats
every interpolated value as literal text unconditionally, rather than a mechanism whose safety depends on
the template's own static text never containing a shell metacharacter. A run that fails before a commit is
created MUST leave the repository in a
state where the identical command can be re-run without manual cleanup: any branch created by that run
MUST be removed and any staged changes MUST be unstaged, unless the branch existed before the run began.

#### Scenario: Markdown body survives PR automation

- GIVEN a body file contains backticks, shell-looking text, and an OpenSpec change name
- WHEN the contributor runs the PR helper with that body file
- THEN the created pull request receives the exact file contents
- AND the helper does not execute or expand the body contents

#### Scenario: Direct commit to the default branch fails closed

- GIVEN the repository's default branch is checked out
- WHEN a contributor or agent runs `git commit` with the repository's hooks installed
- THEN the commit is rejected with a message naming the feature-branch remedy
- AND no commit is created

#### Scenario: PR automation on an existing feature branch is unaffected

- GIVEN a feature branch was already created before implementation began
- WHEN the contributor runs the PR helper with `--reuse-branch`
- THEN it continues on that branch, stages, checks, commits, and pushes as before

#### Scenario: Generated body text is always literal regardless of the static template

- GIVEN a `--message` value contains a command substitution or backtick sequence
- WHEN the PR helper builds its default body from that value
- THEN the rendered body contains the literal text
- AND this holds independent of whether the template's own static text later gains a literal backtick or
  `$()` sequence

#### Scenario: A failed run can be retried without manual cleanup

- GIVEN the PR helper creates a new branch, stages changes, and the quality gate then fails
- WHEN the run exits without creating a commit
- THEN the created branch no longer exists and the staged changes are unstaged
- AND running the identical command again, after fixing the failure, succeeds

#### Scenario: A reused branch is never deleted by failure cleanup

- GIVEN a branch already existed before this run, invoked with `--reuse-branch`
- WHEN this run fails before creating a commit
- THEN the branch is not deleted

#### Scenario: A supplied body survives the appended blocks

- GIVEN a body file whose text includes backticks, shell-looking text, and a `## Data / generated output`
  heading
- WHEN the contributor runs the PR helper with that body file
- THEN every supplied line MUST appear in the created pull request byte-for-byte
- AND the generated telemetry block MUST appear inside that section, between its delimiters
- AND the trailer block MUST be appended even though a body file was supplied

### Requirement: Dependency declarations are executable

Repository checks MUST validate that every active OpenSpec change declares `## Dependencies` with either
`None` or exact existing change names. A dependency MUST be considered ready only when its governing change is
archived and its required tasks and verification evidence are complete. The check MUST NOT crash when the
`openspec/changes/` directory or its `archive/` subdirectory does not yet exist; it MUST treat either
absent directory as containing no entries and report its normal pass or fail result rather than an
unhandled error.

#### Scenario: Unknown dependency fails closed

- GIVEN an active OpenSpec change names a nonexistent dependency
- WHEN the repository dependency check runs
- THEN it reports the exact missing dependency and fails

#### Scenario: Missing archive directory does not crash the check

- GIVEN a fresh checkout where `openspec/changes/archive/` does not exist yet (a fork right after
  clearing inherited history, or a new project generated from this template)
- WHEN the dependency check runs
- THEN it completes with its normal pass or fail result
- AND it does not raise an unhandled error naming an internal file path

### Requirement: Roadmap order reflects dependency readiness

Roadmap checks MUST reject a dependent change listed before an unready predecessor and MUST require `Blocked`
status when a named predecessor is not ready. A milestone MAY be `Pending` or `In progress` only when its
predecessors are ready; `Complete` remains reserved for archived changes with recorded verification.

#### Scenario: Unready predecessor blocks later work

- GIVEN roadmap change B depends on unarchived change A
- AND B appears after A but is marked `Pending`
- WHEN the roadmap dependency check runs
- THEN it reports B as blocked or drifted
- AND it does not accept B as dependency-ready

### Requirement: A pull request body records the branch's session telemetry

The PR automation MUST include, in every pull request body it creates, a generated section naming every
session record added on the branch relative to the base: the record's path, its session identifier, its
provider and model, its figures, and its local check outcome, followed by each record's content. A record
whose harness supplied no figures MUST be named as missing figures and MUST NOT be rendered as a zero cost
or a zero token count. When the branch adds no session record, the section MUST say so explicitly rather
than being omitted or left empty. The section MUST be placed inside the body's data section when the body
has one, and MUST be built from the session files and git alone, never from the projection. A field placed
in a table cell MUST be escaped so that a pipe in its value cannot end the cell.

#### Scenario: A branch with a recorded session

- GIVEN a branch carrying one session record with figures and one carrying `figuresMissing`
- WHEN the PR helper opens the pull request
- THEN the description MUST name both records with their session identifiers and check outcomes
- AND the second MUST read as missing figures rather than as zero cost

#### Scenario: A branch with no session record

- GIVEN a branch that adds no session file
- WHEN the PR helper opens the pull request
- THEN the description MUST state explicitly that the branch recorded no session

#### Scenario: A pipe in a model name stays in its cell

- GIVEN a session record whose model string contains a pipe
- WHEN the section is generated
- THEN the row MUST keep its five cells with the pipe escaped

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

### Requirement: Continuous integration refuses undeclared work

The ledger workflow SHALL fail a pull request whose commits relative to the base carry no `Session:`
trailer and whose body neither names a session nor carries `Session: undeclared`, and SHALL print the same
three ways forward the PR helper prints. `scripts/pr.sh --allow-undeclared` SHALL write
`Session: undeclared` into the body so the override is visible to the workflow.

#### Scenario: An undeclared pull request fails the build

- GIVEN a pull request with no `Session:` trailer on its commits and none in its body
- WHEN the ledger workflow runs
- THEN the declared check MUST fail naming the three ways forward

#### Scenario: An explicit override passes

- GIVEN a pull request whose body carries `Session: undeclared`
- WHEN the ledger workflow runs
- THEN the declared check MUST pass and say the work is undeclared on purpose
