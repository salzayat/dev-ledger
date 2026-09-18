# Fix Session None Default

## Why

Two accepted specs give `Session: none` two different meanings, and the difference is the difference between
a declaration and a gap.

`openspec/specs/telemetry-capture/spec.md:117-118` defines it as "the active session identifier, or `none`
when no harness session is active" — an absence. `openspec/specs/flow-observability/spec.md:145-149` defines
it as a declaration: a change whose commits carry `Session: none` "MUST NOT be marked `undeclared` or
`unreported`", which is to say the repository asserts a human did that work without an agent. The projection
implements the second reading (`packages/flow/src/sessions.ts:88-92`: a `none` trailer sets `sawTrailer` and
contributes no declared session, so the change is counted as human-only rather than as a gap).

The hook implements the first. `.githooks/prepare-commit-msg:26-27` reads `telemetry.session` from git
configuration and falls back to `none` whenever it is unset. Nothing about that fallback means a human
worked alone; it means the configuration was not set. So every commit made without an active harness session
is silently recorded as a positive claim of human-only work.

The common trigger is not a forgotten `session start`. `telemetry session end` unsets `telemetry.session`
(`packages/capture/src/cli.ts:308-312`), so from the moment a session is recorded, every further commit on
that branch — review fixes, a follow-up, a revert — is declared human-only. Both non-revert instances in this
repository's history are exactly that: `3667d9c docs(flow): use the plain label in the methodology summary`
and `56f9832 fix(flow): scrub inherited git location variables from child processes`, each landing on a
branch after that branch's session record had already been committed. The commit that opened this pull
request's own branch carries `Session: none` for the same reason.

This now falsifies an accepted read. `openspec/specs/flow-observability/spec.md:190-212` requires coverage
counts of "changes with an agent session, human-only, undeclared, and unreported". The human-only count is
computed from a value the hook writes when it knows nothing, so the read reports agent work as human work and
reports no gap where a gap exists.

## What Changes

- Stop defaulting the `Session:` trailer. When `telemetry.session` is unset, `.githooks/prepare-commit-msg`
  SHALL write no `Session:` trailer at all, so the change is counted `undeclared` — a gap the projection
  already states and counts — rather than declared human-only.
- Make `none` deliberate. Provide an explicit way to declare human-only work for a branch, so the
  declaration is something an operator states rather than something a missing configuration produces.
- Amend `openspec/specs/telemetry-capture/spec.md:117-118` so `none` means declared human-only work in both
  specs, and absence of an active session means no trailer.
- Document the distinction where the trailers are documented, including what happens to commits made after
  `telemetry session end` has unset the configuration.

## Dependencies

None. This corrects an accepted requirement against the reading the projection already implements, and
depends on no active change.

## Non-Goals

- No change to how the projection reads `Session: none`. `packages/flow/src/sessions.ts:88-92` is already
  correct; the defect is on the writing side.
- No change to the `undeclared` or `unreported` classifications, or to their counting rules.
- No backfill or rewriting of the five commits in this repository's history that carry the defaulted value.
  History is not rewritten to correct a record.
- No requirement that a session be active before a commit is allowed. A commit with no session stays legal
  and becomes visible as a gap rather than being blocked.
- No change to `telemetry session start` or `session end` semantics beyond what the trailer needs; ending a
  session still unsets the configuration.
