# Tasks: Add Flow Observability

## Capture package

- [x] 1.1 Replace `packages/hello` with `packages/capture` (source-only, same targets): session file schema
      (versioned) and validator; `telemetry.config.json` schema (effort vocabulary, cost allocation block,
      idle cap, pseudonymous operator identifiers, cost-class vocabulary) and its "as of commit" reader.
- [x] 1.2 Hooks under `.githooks/`: `prepare-commit-msg` (`Spec:`, `Session:`, `Change:`, effort and
      `Cost-Class:` trailers from branch-local git configuration), `commit-msg` (trailer validation, subject
      length), `pre-commit` (session file schema), `pre-push` (uncommitted finished session file); the
      installer extends the existing `scripts/install-git-hooks.sh`.
- [x] 1.3 Harness session-end hook: writes the session file from the harness's figures, records the local
      check outcome, computes operator active seconds under the idle cap only when cost allocation is
      enabled, and commits the file as its own commit.
- [x] 1.4 `scripts/pr.sh`: store the change name, spec, and session in branch-local git configuration and
      write the distinct `Spec:` and `Session:` values at the end of the pull request description.
- [x] 1.5 `.gitattributes`: `.telemetry/sessions/** linguist-generated`.
- [x] 1.6 Unit tests: schema validation (negative tokens, missing fields, name or email present, rate
      present), subscription cost zero with `notionalCostUsd`, idle cap arithmetic, operator fields absent
      when allocation is off, configuration read as of a commit.

## Flow package

- [x] 2.1 Replace `packages/greeter` with `packages/flow`, depending on `capture` the way `greeter` depended
      on `hello`.
- [x] 2.2 `src/registry.ts`: `registry.json` schema (name, SSH URL, default branch, release tag pattern,
      thresholds) and validation.
- [x] 2.3 `src/sync.ts`: mirror-fetch each repository with `+refs/*:refs/*` including tags and pull heads,
      record fetched ref tips, record unreachable repositories with the reason.
- [x] 2.4 `src/changes.ts`: first-parent walk, change grouping for squash, merge commit, and rebase, trailer
      resolution, `conflicting-trailer` gap.
- [x] 2.5 `src/association.ts`: pull request number from the subject, patch identity against pull head refs,
      exhaustive classification, unmerged pull heads with age, sessions on unmerged pull heads.
- [x] 2.6 `src/sessions.ts`: declared, undeclared, unreported, `Session: none`, gap records.
- [x] 2.7 `src/timing.ts`: cycle time and wait time from the pull head ref, absent with reason when no pull
      head exists.
- [x] 2.8 `src/releases.ts`: tag pattern, membership by ancestry, unreleased list, cherry-pick resolution by
      reference or patch identity, unmapped changes, moved tags.
- [x] 2.9 `src/signals.ts`: cycle time, wait time, queue, batch size, merge frequency, rework, escapes,
      local check outcomes, spend by change, spec, provider, model, and per effort unit; excluded counts;
      thresholds; per repository and aggregate; no person dimension.
- [x] 2.10 `src/projection.ts`: canonical sorted-key JSON with schema versions and ref tips, topological
      order, deletable; `src/cursor.ts` per-repository cursors with reset on unreachable commit.
- [x] 2.11 `src/board.ts`: The Board as a terminal or static HTML render over the projection, with citations,
      trust classes, excluded counts, and an empty state.
- [x] 2.12 `scripts/telemetry.sh` with `session`, `validate`, `sync`, `rebuild`, `cursor`, `board`.
- [x] 2.13 Unit tests over fixture repositories built in a temporary directory: every scenario in
      `specs/flow-observability/spec.md`, including two clones rebuilding byte-identically, association by
      subject and by patch identity, out-of-band, unmerged age, wait time surviving a rebase merge, absent
      timing never zero, rework, escapes, threshold signals, release membership, cursor reset.

## Documentation

- [x] 3.1 `README.md`: replace the teaching description with what this repository is, the quick start
      (`npm ci`, install hooks, register a repository, `sync`, `rebuild`, `board`), and what it does not see
      (reviews, checks, platform timestamps) with a pointer to the second phase, `add-change-audit`.
- [x] 3.2 `docs/methodology.md`: what a change is, how association works and its limits, why timing comes
      from the pull head ref, what undeclared and unreported mean, why nothing is keyed to a person, the
      recommended merge message setting and what is lost without it.
- [x] 3.3 `docs/contract.md`: the versioned session schema, trailer vocabulary, registry format, and
      projection schema that the second phase, `add-change-audit`, builds on.
- [x] 3.4 `openspec/specs/repository-foundation/spec.md`: replace `greet` and `announce` with the capture
      and flow packages' contracts, per `TEMPLATE.md` step 2.
- [x] 3.5 `plans/roadmap.md`: this change as the first product milestone, with the R&D allocation export as
      the next row, `Blocked` on this one.

## Verification

- [x] 4.1 `npm run check` passes (2026-09-17, branch `draft-two-phase-roadmap`; the pre-commit hook runs it
      again on every commit).
- [x] 4.2 End to end: register this repository and `binary-logic`, `sync`, `rebuild` on two machines (or two
      clones with the same mirrors), and confirm byte-identical projections and equal content hashes.
      Evidence (2026-09-17): two clones of the `draft-two-phase-roadmap` branch registered `dev-ledger` and `binary-logic`, ran `sync`
      and `rebuild`, and both printed `sha256 b563f944a5f0835fe15bdb516c0be70dcdaf1551ac9ef027a761daf72edd0f97`;
      `cmp` found the two projections byte-identical.
- [x] 4.3 End to end: five pull requests merged interleaved by squash, merge commit, and rebase, each
      recorded once with the correct association method; one direct push classified out-of-band; one open
      branch with a pull request listed as unmerged with its age.
      Evidence (2026-09-17): `packages/flow/src/flow.test.ts`, "five pull requests merged interleaved by three methods are each
      recorded once" (squash, rebase, merge commit, squash, rebase; association by subject and by patch identity).
      Over the real repositories, association reported 36 of 37 `dev-ledger` changes and 41 of 43 `binary-logic`
      changes by subject, the rest out-of-band; the test "a direct push is out-of-band and an unmerged pull head is
      listed with its age" covers the direct push and the open branch.
- [x] 4.4 End to end: wait time and queue age over this repository's own history, with the changes behind
      each figure listed by The Board.
      Evidence (2026-09-17): The Board over this repository's own history (the spec-loop pull requests, pull head refs fetched):
      wait time p50 3m, p90 1.3h, max 1.8h over 36 changes; cycle time p50 13m; queue 4 unmerged pull requests,
      oldest 16.1d as of the newest commit the mirror holds; every figure lists the changes behind it.
- [x] 4.5 End to end: `rebuild` over a synthetic history of 1,000 changes, with wall-clock recorded.
      Evidence (2026-09-17): `DEV_LEDGER_SYNTHETIC_CHANGES=1000` run of the synthetic test: rebuild over 1,000 squash-merged changes
      took 14,932ms after batching the per-change git reads (176,717ms before).
- [x] 4.6 End to end: a commit with a subject over 100 characters rejected by the `commit-msg` hook, and the
      same subject with hooks skipped surfacing as a gap after merge.
      Evidence (2026-09-17): in a clone with the hooks installed, a 120-character subject was rejected by `commit-msg`; the same
      subject committed with `core.hooksPath=/dev/null` and squash-merged as `(#999)` rebuilt as a `pull-request`
      change with `sessions.status: undeclared` and an `undeclared-session` gap.
- [x] 4.7 Tag `v0.1.0` and record the tag in this file; it is the phase one release the second phase builds on.
      Evidence (2026-09-17): `v0.1.0` is an annotated tag on `a75c192`, the merge commit of pull request #3, after
      pull requests #1, #2, and #3 (one per spec) merged into `main`.
