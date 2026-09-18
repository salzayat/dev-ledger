# Tasks: Refine Ledger After Review

- [x] 1.1 `scripts/harness/claude-code.sh` and `.claude/settings.json`: SessionStart and SessionEnd hooks;
      `session figures --model-only` reads the model from the transcript.
- [x] 1.2 `scripts/check-declared.sh` in `ledger.yml` on pull requests; `pr.sh --allow-undeclared` writes
      `Session: undeclared` into the body.
- [x] 1.3 `session end` atomic: failed commit removes the record, keeps the session, prints the hook's error.
- [x] 2.1 Spec lead time from the proposal file's first appearance when earlier than the first trailer.
- [x] 2.2 Flow efficiency by session-window and cycle-window overlap, with `outsideSeconds` reported.
- [x] 2.3 Registry `measuredFrom` and `closedPullRequests`; `signals.boundary`; page and terminal show it.
- [x] 3.1 Notes: `packages/capture/src/notes.ts`, `telemetry note add`, `validate` covers them,
      `packages/flow/src/notes.ts`, the records tab panel; this repository's six notes recorded.
- [x] 3.2 Docs: methodology, contract, README cut to essentials, roadmap row.
- [x] 4.1 Tests: boundary and closed declaration; overlap efficiency and proposal-start lead time; notes
      rendered; note command and validation.
- [x] 4.2 `npm run check`; a rebuild over this repository recorded in the pull request. Evidence
      (2026-09-18): sha256 `3bf60929…`; boundary 37 changes before 2026-09-17 excluded, #14 declared closed;
      coverage 16 agent, 11 human-only, 7 undeclared of 34; work mix feat 17, docs 10, fix 6, other 1; flow
      efficiency 5% typical over 6 changes (was 200%); rework 154 pairs; spec lead time 13m typical over 8.
