# Tasks: Add Flow Observability

## Capture package

- [ ] 1.1 Replace `packages/hello` with `packages/capture` (source-only, same targets): session file schema
      (versioned) and validator; `telemetry.config.json` schema (effort vocabulary, cost allocation block,
      idle cap, pseudonymous operator identifiers, cost-class vocabulary) and its "as of commit" reader.
- [ ] 1.2 Hooks under `.githooks/`: `prepare-commit-msg` (`Spec:`, `Session:`, `Change:`, effort and
      `Cost-Class:` trailers from branch-local git configuration), `commit-msg` (trailer validation, subject
      length), `pre-commit` (session file schema), `pre-push` (uncommitted finished session file); the
      installer extends the existing `scripts/install-git-hooks.sh`.
- [ ] 1.3 Harness session-end hook: writes the session file from the harness's figures, records the local
      check outcome, computes operator active seconds under the idle cap only when cost allocation is
      enabled, and commits the file as its own commit.
- [ ] 1.4 `scripts/pr.sh`: store the change name, spec, and session in branch-local git configuration and
      write the distinct `Spec:` and `Session:` values at the end of the pull request description.
- [ ] 1.5 `.gitattributes`: `.telemetry/sessions/** linguist-generated`.
- [ ] 1.6 Unit tests: schema validation (negative tokens, missing fields, name or email present, rate
      present), subscription cost zero with `notionalCostUsd`, idle cap arithmetic, operator fields absent
      when allocation is off, configuration read as of a commit.

## Flow package

- [ ] 2.1 Replace `packages/greeter` with `packages/flow`, depending on `capture` the way `greeter` depended
      on `hello`.
- [ ] 2.2 `src/registry.ts`: `registry.json` schema (name, SSH URL, default branch, release tag pattern,
      thresholds) and validation.
- [ ] 2.3 `src/sync.ts`: mirror-fetch each repository with `+refs/*:refs/*` including tags and pull heads,
      record fetched ref tips, record unreachable repositories with the reason.
- [ ] 2.4 `src/changes.ts`: first-parent walk, change grouping for squash, merge commit, and rebase, trailer
      resolution, `conflicting-trailer` gap.
- [ ] 2.5 `src/association.ts`: pull request number from the subject, patch identity against pull head refs,
      exhaustive classification, unmerged pull heads with age, sessions on unmerged pull heads.
- [ ] 2.6 `src/sessions.ts`: declared, undeclared, unreported, `Session: none`, gap records.
- [ ] 2.7 `src/timing.ts`: cycle time and wait time from the pull head ref, absent with reason when no pull
      head exists.
- [ ] 2.8 `src/releases.ts`: tag pattern, membership by ancestry, unreleased list, cherry-pick resolution by
      reference or patch identity, unmapped changes, moved tags.
- [ ] 2.9 `src/signals.ts`: cycle time, wait time, queue, batch size, merge frequency, rework, escapes,
      local check outcomes, spend by change, spec, provider, model, and per effort unit; excluded counts;
      thresholds; per repository and aggregate; no person dimension.
- [ ] 2.10 `src/projection.ts`: canonical sorted-key JSON with schema versions and ref tips, topological
      order, deletable; `src/cursor.ts` per-repository cursors with reset on unreachable commit.
- [ ] 2.11 `src/board.ts`: The Board as a terminal or static HTML render over the projection, with citations,
      trust classes, excluded counts, and an empty state.
- [ ] 2.12 `scripts/telemetry.sh` with `session`, `validate`, `sync`, `rebuild`, `cursor`, `board`.
- [ ] 2.13 Unit tests over fixture repositories built in a temporary directory: every scenario in
      `specs/flow-observability/spec.md`, including two clones rebuilding byte-identically, association by
      subject and by patch identity, out-of-band, unmerged age, wait time surviving a rebase merge, absent
      timing never zero, rework, escapes, threshold signals, release membership, cursor reset.

## Documentation

- [ ] 3.1 `README.md`: replace the teaching description with what this repository is, the quick start
      (`npm ci`, install hooks, register a repository, `sync`, `rebuild`, `board`), and what it does not see
      (reviews, checks, platform timestamps) with a pointer to the second phase, `add-change-audit`.
- [ ] 3.2 `docs/methodology.md`: what a change is, how association works and its limits, why timing comes
      from the pull head ref, what undeclared and unreported mean, why nothing is keyed to a person, the
      recommended merge message setting and what is lost without it.
- [ ] 3.3 `docs/contract.md`: the versioned session schema, trailer vocabulary, registry format, and
      projection schema that the second phase, `add-change-audit`, builds on.
- [ ] 3.4 `openspec/specs/repository-foundation/spec.md`: replace `greet` and `announce` with the capture
      and flow packages' contracts, per `TEMPLATE.md` step 2.
- [ ] 3.5 `plans/roadmap.md`: this change as the first product milestone, with the R&D allocation export as
      the next row, `Blocked` on this one.

## Verification

- [ ] 4.1 `npm run check` passes.
- [ ] 4.2 End to end: register this repository and `binary-logic`, `sync`, `rebuild` on two machines (or two
      clones with the same mirrors), and confirm byte-identical projections and equal content hashes.
- [ ] 4.3 End to end: five pull requests merged interleaved by squash, merge commit, and rebase, each
      recorded once with the correct association method; one direct push classified out-of-band; one open
      branch with a pull request listed as unmerged with its age.
- [ ] 4.4 End to end: wait time and queue age over this repository's own history, with the changes behind
      each figure listed by The Board.
- [ ] 4.5 End to end: `rebuild` over a synthetic history of 1,000 changes, with wall-clock recorded.
- [ ] 4.6 End to end: a commit with a subject over 100 characters rejected by the `commit-msg` hook, and the
      same subject with hooks skipped surfacing as a gap after merge.
- [ ] 4.7 Tag `v0.1.0` and record the tag in this file; it is the phase one release the second phase builds on.
