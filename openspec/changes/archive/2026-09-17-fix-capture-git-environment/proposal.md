# Fix Capture Git Environment

## Why

`packages/capture/src/cli.ts:22-31` runs every git child with the ambient environment. The `flow` package
does not: `gitEnvironment()` (`packages/flow/src/git.ts:31-41`) strips `GIT_DIR`, `GIT_INDEX_FILE`,
`GIT_WORK_TREE`, and the other inherited variables before each call, and a test holds that behavior
(`packages/flow/src/flow.test.ts:562`, "child git processes never inherit a parent index or repository").
`capture` is the package whose commands run _inside_ git hooks, where exactly those variables are exported,
so it is the one that needed the guard most.

The failure is not hypothetical. It happened in this repository while this branch was being written:
`telemetry session end` ran from a context where `GIT_INDEX_FILE` pointed at the repository's real index
while the working directory was a fixture, and the resulting commit failed with
`error: invalid object 100644 2d50ee5f… for '.telemetry/sessions/2026-09/s-blind.json'` /
`error: Error building trees` — index entries naming fixture paths whose objects live in another
repository's object database. A session record could not be committed until the index was repaired by hand.

## What Changes

- `capture`'s git helper builds its child environment the way `flow`'s does: `GIT_TERMINAL_PROMPT=0`,
  `LC_ALL=C`, and every inherited git variable removed, so a command invoked from a hook acts on the
  repository it was pointed at and never on the caller's index.
- The rule is stated for both packages in one accepted requirement rather than being a property one
  package happens to have.

## Dependencies

None.

## Non-Goals

- No change to what any command records, to the session file schema, or to the trailers.
- No new dependency: `capture` still needs nothing but git and itself, and does not import the flow
  package's helper.
- No change to how the hooks are installed or invoked.
