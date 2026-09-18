# Tasks: Add Hook Drift Check

## 1. The check

- [x] 1.1 Add `scripts/check-hooks-current.sh` resolving the effective `core.hooksPath` against the current
      working tree root.
- [x] 1.2 Report `core.hooksPath` unset as hooks not installed, naming `./scripts/install-git-hooks.sh`.
- [x] 1.3 Exit quietly when the effective path is this working tree's own `.githooks`.
- [x] 1.4 Compare every hook in this working tree's `.githooks` with the file at the effective path, and
      name each one that differs or is missing there.
- [x] 1.5 Report a path holding none of the repository's hooks as a misconfiguration, distinctly from drift.
- [x] 1.6 Warn without failing: exit 0 in every case, so a stale sibling checkout does not block a commit.

## 2. Wiring and documentation

- [x] 2.1 Run it from `scripts/check.sh`.
- [x] 2.2 Document it in `README.md` beside the other repository checks, and say why it warns rather than
      fails.

## 3. Verification

- [x] 3.1 Test the drifted case over a fixture: a hooks directory whose file differs from the working tree's,
      asserting the hook is named and the exit status is 0.
- [x] 3.2 Test the matching case, asserting no warning.
- [x] 3.3 Test the unset case and the empty-directory case, asserting each names its own remedy.
- [x] 3.4 Confirm the check reports this repository's real state correctly, before and after the main
      checkout is updated.
- [x] 3.5 Run `npm run check` and record the result in the pull request.
