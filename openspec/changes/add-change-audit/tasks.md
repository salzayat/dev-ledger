# Tasks: Add Change Audit

## Phase one

- [ ] 1.1 Confirm `add-flow-observability` is archived and `v0.1.0` is tagged, and record the tag here. The
      `capture` and `flow` packages are not edited by this change.

## Audit package

- [ ] 2.1 Add `packages/audit`, depending on `flow` and `capture` in-workspace the way `flow` depends on
      `capture`, with the same targets.
- [ ] 2.2 `src/rules/`: the rule type (identifier, version, record types, severity, controls, typed
      aggregation key with no person member, needs-collector flag) and the baseline rules: pull request
      associated, spec present, session declared, session reported, not out-of-band, no conflicting trailer,
      local check passed; the collector-dependent rules: reviewer distinct from author, reviewer
      independence, checks green, protection recorded, deployment linked.
- [ ] 2.3 `seeds/`: `hygiene`, `change-control`, `regulated`, `pci-dss`, `hipaa`, `productivity`, each
      mapping rule identifiers to control labels; loader rejects unknown identifiers.
- [ ] 2.4 `src/config.ts`: `config/<repository>.json` (level, packs, independence and path scopes, approved
      reviewers, collector setting); effective rule set as the union with deduplication; pack on an
      insufficient level rejected; lowering a level reports what stops running.
- [ ] 2.5 `src/exceptions.ts`: exception with operator, reason, expiry; suppression reported; expiry restores
      the rule; removal of a shipped rule refused.
- [ ] 2.6 `src/run.ts`: run over the registry, scope by window or release, record projection hash, schema
      versions, collector state per repository, effective configuration, active exceptions; per-repository
      and aggregate findings naming unreachable repositories.
- [ ] 2.7 `src/findings.ts`: recomputed, content-addressed over rule identifier, rule version, sorted cited
      record identifiers.
- [ ] 2.8 `src/decisions.ts`: append-only `decisions/<repository>/<period>.jsonl`; resolution requires a
      reason; state as the fold; restated decision detection from file history.
- [ ] 2.9 `src/controls.ts`: four control states including `not-observable` with reason; preventive or
      detective per period; gaps as findings; a gap leaves dependent controls unevidenced.
- [ ] 2.10 `src/independence.ts`: `none`, `distinct-model`, `distinct-provider`, `distinct-human`; path
      scopes with strictest match; observed reviews only; stale review is unreviewed; publisher comparison;
      human required on hook, workflow, instruction, and configuration paths.
- [ ] 2.11 `src/pack.ts`: release-scoped Markdown pack with index, one document per control, gaps beside
      changes, not-observable controls, exceptions, no compliance claim, manifest hash; export appends a
      decision; `verify` regenerates and compares.
- [ ] 2.12 `src/retention.ts`: retention horizon per source and shortfall findings.
- [ ] 2.13 `src/projection.ts`: canonical-JSON audit projection from configuration, decisions, collector
      records, and the flow projection; byte-identical rebuild; payload-bearing records rejected.
- [ ] 2.14 `src/productivity.ts`: reads over the flow projection's spend and effort reads with excluded counts and
      the minimum-sample refusal.
- [ ] 2.15 `src/board.ts`: the governance view added to the phase one Ledger (controls in four states,
      exceptions, run history, pack generation, configuration preview expressed as a file edit) and the
      productivity rule set's panels beside the spend panels; citations on every figure, no score,
      no person dimension.
- [ ] 2.16 `scripts/audit.sh` with `run`, `findings`, `ack`, `resolve`, `except`, `pack`, `verify`,
      `rebuild`; `scripts/telemetry.sh ledger` renders the extended Ledger.
- [ ] 2.17 Unit tests over fixture projections: every scenario in `specs/change-audit/spec.md`, and a test
      asserting no rendered output carries a per-person total.

## Collector

- [ ] 3.1 `.github/workflows/collector.yml`: schedule and dispatch, least permissions, actions pinned by
      commit, event fields through environment variables only, the read-only credential from this
      repository's secrets, records validated then pushed to a workflow-owned branch, one standing pull
      request opened with the run's token.
- [ ] 3.2 `packages/audit/src/collector/`: per enabled repository, read pull requests, merge method and
      produced commits, times, reviews with commit and class, checks, deployment runs, protection status;
      append to `records/<repository>/<period>.jsonl`; corrections by appended record; credential expiry
      finding; look-back re-derivation within a request budget with `restated-record` on differences;
      association disagreement with the flow projection reported.
- [ ] 3.3 Tests with a recorded platform fixture: every scenario in `specs/platform-collector/spec.md`.
- [ ] 3.4 The repository check lints workflows for expression interpolation in shell steps.

## Documentation

- [ ] 4.1 `README.md`: what phase two adds over phase one, the git-only
      baseline and what it proves, enabling the collector and the credential scopes, and what a pack is and
      is not.
- [ ] 4.2 `docs/methodology.md`: extend the page with levels and packs, why a suppressed rule
      still appears, the four control states, why `distinct-session` is not a level, why controls are
      detective without the collector, and the retention numbers.
- [ ] 4.3 `plans/roadmap.md`: this change `Blocked` on `add-flow-observability` until it archives; the `regulated` level's first real case and further standard packs as later rows.

## Verification

- [ ] 5.1 `npm run check` passes, including phase one's `capture` and `flow` tests.
- [ ] 5.2 End to end, collector off: register this repository and `binary-logic`, set `change-control`, run
      over post 2's records, quote two findings by identifier, acknowledge one, resolve one with a reason,
      export a pack and confirm the not-observable controls are listed with reason `collector-off`, re-run
      and confirm the pack hash is unchanged.
- [ ] 5.3 End to end: delete the local audit store, rebuild in a fresh clone, and confirm every finding
      state, exception, and pack reference returns byte-identically.
- [ ] 5.4 End to end: enable `pci-dss` beside `hipaa`, confirm a shared rule appears once with both
      controls, attempt to delete a shipped rule and confirm the refusal offers an exception.
- [ ] 5.5 End to end, collector on (a later week, once a credential is provisioned): merge a change reviewed
      by a different provider's agent and confirm `distinct-provider` passes, merge one reviewed by the same
      provider and confirm the finding names both levels, push after review and confirm the change reads
      unreviewed, hand-edit a record and confirm the restatement on the next run.
- [ ] 5.6 Run phase one's Ledger tests unchanged against the extended Ledger and confirm the flow views render
      as before.
