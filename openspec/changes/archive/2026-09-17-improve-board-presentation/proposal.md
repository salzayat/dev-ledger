# Improve Board Presentation

## Why

`add-board-dashboard` made The Board a page, but it made it a page of numbers. Two concrete gaps show up
the moment someone opens `.telemetry/board.html` over a real repository:

- Every citation is a bare abbreviated hash. `cites()` renders `<li><code>${short(id)}</code></li>`
  (`packages/flow/src/board-html.ts:60-68`), and `short()` (`packages/flow/src/board-html.ts:33-39`)
  truncates a 40-character change id to ten characters. A reader looking at a wait-time outlier or an
  out-of-band change gets `3667d9c2a1` and nothing else: no subject, and no way to reach the commit on
  the hosting platform. The subject is already in the projection — `changes[].subject`
  (`packages/flow/src/projection.ts:256`) — and the remote is already in the registry
  (`registry.json`, `RegistryEntry.url`, `packages/flow/src/registry.ts:15`); neither reaches the page.
- The only visualization on the page is one three-bar SVG per distribution (`bars()`,
  `packages/flow/src/board-html.ts:77-95`). Everything else — batch size, merge frequency, rework,
  escapes, queue age, spend by spec, provider, and model — is a single large number or an unsorted table,
  so nothing on the page shows shape or movement over time, which is what a flow surface is for.

Nothing about either gap needs a new record. Both are presentation over the projection that already
exists, which is why this is an addendum to phase one rather than a change to what is collected.

## What Changes

- The projection records, per repository, a `webUrl`: the `https://<host>/<owner>/<repo>` form of the
  registry URL when that URL is a recognizable GitHub remote (SSH, `ssh://`, or HTTPS), and `null`
  otherwise. `PROJECTION_SCHEMA_VERSION` goes to 2. No local filesystem path is ever written, so a
  registry entry pointing at a local mirror keeps the projection machine-independent.
- Every hash on the HTML Board renders as the abbreviated hash followed by the change's subject, and the
  hash is a link to the commit on the platform when `webUrl` is set: citation lists, the recent-changes
  table, rework pairs, escapes, and out-of-band changes. Pull request numbers link to the pull request;
  cited session record paths link to the file on the default branch. With `webUrl` null, the same text
  renders unlinked.
- The page gains inline-SVG visualizations beside the figures that had none: merge activity per day over
  the measured window, lines changed per recent change, unmerged queue age per pull request, most-reworked
  files, and proportional bars inside the spend tables. The distribution chart gains a scale and gridlines.
- The page's presentation is reworked: a header band with per-repository summary, trust classes as legible
  chips rather than bare words, sorted and aligned tables, and an accent scale that stays legible in light
  and dark schemes and at phone width.
- The self-containment rule is stated as what it has always meant: no script, and no external resource
  loaded by the page (no `src`, no `<link>`, no CSS `url()` or `@import`). Anchors to the platform are
  navigation, not a loaded resource, and are allowed.

## Dependencies

`add-board-dashboard` (archived): this change edits the page that change introduced.

## Non-Goals

- No new collection and no new record. Subjects, hashes, pull request numbers, and session paths are all
  already in the projection; only the repository `webUrl` is added, and it is derived from `registry.json`.
- No script on the page, and no external resource loaded by it. The page stays a function of the
  projection file.
- No figure keyed to a person, and no person offered as a dimension or as a link target.
- No platform API call. The links are string-built from the registry URL and are not verified to resolve.
- No change to the terminal render's output shape (`packages/flow/src/board.ts`).
- No charting library. Every visualization is inline SVG computed from the projection.
