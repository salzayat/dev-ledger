# Tasks: Add Spec Cost Classes

- [x] 1.1 ~3 `packages/capture/src/classes.ts` and `telemetry class set`: the declaration, validated
      against the vocabulary and the spec pattern; `validate` covers it.
- [x] 1.2 ~3 `packages/flow`: read the declarations; resolve session, trailer, spec, else unclassified;
      allocated, hours, and sources per class; outside-window time by spec.
- [x] 1.3 ~2 The Ledger: reported, allocated, hours, and "declared by" columns; outside time by spec in the
      efficiency panel.
- [x] 2.1 ~1 `.telemetry/classes.json` declaring this repository's specs `rd`; the change-drafting skill asks
      for task weights; docs and roadmap.
- [x] 3.1 ~2 Tests: a spec declaration classifies a session with no class of its own; a session class wins;
      allocated and hours land on the class; `class set` validates.
- [x] 3.2 ~1 `npm run check`; a rebuild over this repository recorded in the pull request. Evidence
      (2026-09-19): sha256 `80587b42…`; the class panel carries allocated $100.00 and 14.75 h on
      `unclassified` with 23 records resolved by no source, because declarations are read from the default
      branch and `classes.json` lands with this change; outside-window time by spec led by
      `refine-ledger-after-review` at 5.1 h.
