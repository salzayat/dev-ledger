# Design: Fix Capture Git Environment

## The guard is duplicated, not shared

The obvious move is to export `gitEnvironment()` from `flow` and import it in `capture`. That inverts the
dependency the repository is built on: `capture` is the package that "needs nothing but git and this
package, so a repository can record sessions before the flow package exists"
(`packages/capture/src/cli.ts:13-14`), and `flow` already depends on `capture`
(`packages/flow/src/history.ts:1-6`). Importing the other way would make a session hook fail to run in a
repository that carries only the capture package.

So the variable list is stated in each package, and the accepted requirement — not an import — is what
keeps them the same. The list is short, closed, and set by git itself: `GIT_DIR`, `GIT_INDEX_FILE`,
`GIT_WORK_TREE`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_PREFIX`,
`GIT_COMMON_DIR`.

## The test drives git from a hostile environment

A test that merely asserts the helper returns an environment without those keys would pass over a helper
that never uses it. The test sets `GIT_INDEX_FILE` and `GIT_DIR` to nonexistent paths in `process.env`,
then runs a real command against a fixture repository: with the ambient environment it fails with
`Could not access 'main..HEAD'`, and with the guard it succeeds. That is the same shape as the flow
package's existing test, which is the behavior being generalized.
