# Tasks: Fix Session None Default

## 1. The trailer default

- [ ] 1.1 Remove the `none` fallback at `.githooks/prepare-commit-msg:26-27` so no `Session:` trailer is
      written when `telemetry.session` is unset and no branch-local declaration is present.
- [ ] 1.2 Read a branch-local human-only declaration in the hook, alongside the existing
      `branch.<name>.telemetry-*` values, and write `Session: none` only when it is set.
- [ ] 1.3 Keep writing the active session identifier unchanged when `telemetry.session` is set.

## 2. Declaring human-only work

- [ ] 2.1 Add a command that sets and clears the branch-local human-only declaration, beside
      `telemetry session start` in `packages/capture/src/cli.ts`.
- [ ] 2.2 Accept the declaration in `scripts/pr.sh` so a human-only branch can be declared at pull request
      time, and carry `Session: none` into the pull request description as it does today.
- [ ] 2.3 Leave `telemetry session end` unsetting `telemetry.session`
      (`packages/capture/src/cli.ts:308-312`) unchanged.

## 3. Specification and documentation

- [ ] 3.1 Amend `openspec/specs/telemetry-capture/spec.md:117-118` through this change's delta so `none`
      means a deliberate declaration of human-only work in both specs.
- [ ] 3.2 Document in `README.md` and `docs/contract.md` that a commit made with no active session is
      `undeclared`, that `none` must be declared, and that commits made after `telemetry session end` fall
      into the first case.

## 4. Verification

- [ ] 4.1 Test that a commit made with `telemetry.session` unset and no declaration carries no `Session:`
      trailer, and that the projection marks its change `undeclared`.
- [ ] 4.2 Test that a commit made with the human-only declaration set carries `Session: none`, and that the
      projection marks its change neither `undeclared` nor `unreported`.
- [ ] 4.3 Test that a commit made with `telemetry.session` set carries that identifier unchanged.
- [ ] 4.4 Test the post-session window directly: run `telemetry session end`, make a further commit on the
      same branch, and assert that commit carries no `Session:` trailer rather than `Session: none`.
- [ ] 4.5 Test that the `commit-msg` hook still accepts a message carrying no `Session:` trailer, and still
      rejects a malformed session identifier.
- [ ] 4.6 Verify the coverage counts over a fixture containing one agent-session change, one declared
      human-only change, and one change committed with no active session, and assert each lands in its own
      count.
- [ ] 4.7 Run `npm run check`, and run a commit through the installed hooks end to end in each of the three
      states, recording the results in the pull request.
