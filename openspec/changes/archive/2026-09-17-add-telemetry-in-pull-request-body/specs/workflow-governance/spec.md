# workflow-governance Specification Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: A pull request body records the branch's session telemetry

The PR automation MUST include, in every pull request body it creates, a generated section naming every
session record added on the branch relative to the base: the record's path, its session identifier, its
provider and model, its figures, and its local check outcome, followed by each record's content. A record
whose harness supplied no figures MUST be named as missing figures and MUST NOT be rendered as a zero cost
or a zero token count. When the branch adds no session record, the section MUST say so explicitly rather
than being omitted or left empty. The section MUST be placed inside the body's data section when the body
has one, and MUST be built from the session files and git alone, never from the projection.

#### Scenario: A branch with a recorded session

- GIVEN a branch carrying one session record with figures and one carrying `figuresMissing`
- WHEN the PR helper opens the pull request
- THEN the description MUST name both records with their session identifiers and check outcomes
- AND the second MUST read as missing figures rather than as zero cost

#### Scenario: A branch with no session record

- GIVEN a branch that adds no session file
- WHEN the PR helper opens the pull request
- THEN the description MUST state explicitly that the branch recorded no session
