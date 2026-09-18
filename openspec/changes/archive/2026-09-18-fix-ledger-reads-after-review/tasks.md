# Tasks: Fix Ledger Reads After Review

## 1. The reads

- [x] 1.1 `packages/flow/src/signals.ts`: a merge commit's work mix type from its branch commits' most common
      type, record commits not voting; `packages/flow/src/projection.ts` carries the branch subjects.
- [x] 1.2 `packages/flow/src/ledger-html.ts` and `ledger.ts`: the footer says nothing is resolved to a person.
- [x] 1.3 `registry.json`: this repository's `rework.ignore` covers the roadmap, the README, `docs/`,
      `openspec/`, the lockfile, and the telemetry directory.

## 2. The clock

- [x] 2.1 `packages/capture/src/cli.ts`: `session start` records `telemetry.session-started`; `session end`
      fills `startedAt` from it and `endedAt` from now when the payload omits them, and clears both keys.
- [x] 2.2 `packages/capture/src/session.ts`: `startedAt` and `endedAt` optional on the input; the file still
      requires both.

- [x] 2.3 `session end` commits the record without `-c telemetry.session=...`: the identifier is still in the
      repository's configuration when the hook runs, and `-c` exported it through `GIT_CONFIG_PARAMETERS`
      into the hook fixture test, which then failed every record commit. `scripts/test-trailers.sh` also
      unsets that variable.

## 3. The guard

- [x] 3.1 `scripts/pr.sh`: refuse to open a pull request with no active session, no human-only declaration,
      and no prior `Session:` trailer on the branch, unless `--allow-undeclared`; document the flag.

## 4. Documentation

- [x] 4.1 `docs/methodology.md`: work mix from branch commits, session times from the commands, and what
      spec lead time measures when a spec is archived in its implementing pull request.
- [x] 4.2 `docs/contract.md`: the optional times; `README.md`: the guard, the clock, and the refreshed
      reading of the page; `plans/roadmap.md`: this row.

## 5. Verification

- [x] 5.1 Tests: two `feat` branch commits and one `fix` under a merge commit read `feat`, the record commit
      not voting, an untyped branch reads `other`; `session start` records a parseable clock, `session end`
      writes it as `startedAt` with an `endedAt` at or after it, and clears both keys.
- [x] 5.2 `npm run check` passes; `scripts/pr.sh` run in a scratch repository with no session refuses with
      the message naming the three ways forward; a rebuild over this repository reports the work mix and
      rework figures recorded in the pull request. Evidence (2026-09-18): the scratch run refused with
      "No session is active and this branch declares nothing: run ./scripts/telemetry.sh session start
      ..., pass --human-only ..., or --allow-undeclared ..." and restored `main`; the rebuild reported work
      mix `chore 17, feat 14, fix 12, docs 8, ci 1, other 1` where the page had read 61% `other`, and
      rework `201 pairs` where it had read 754.
