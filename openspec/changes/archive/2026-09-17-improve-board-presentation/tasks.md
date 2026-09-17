# Tasks: Improve Board Presentation

## 1. Projection

- [x] 1.1 `packages/flow/src/registry.ts`: `webUrl(url)` resolving an SSH (`git@host:owner/repo.git`),
      `ssh://`, or HTTPS GitHub remote to `https://<host>/<owner>/<repo>`, and returning `null` for a local
      path or any unrecognized form; exported from `packages/flow/src/index.ts`.
- [x] 1.2 `packages/flow/src/projection.ts`: `RepositoryProjection.webUrl` set from the registry entry on
      both the reachable and the unreachable path; `PROJECTION_SCHEMA_VERSION` to 2.

## 2. Hashes carry a title and a link

- [x] 2.1 `packages/flow/src/board-html.ts`: one `cite()` rendering a change id, a `pull/<number>`, a
      session record path, and a `<later><-<earlier>` pair, each as the abbreviated hash or number plus the
      change subject, linked to the platform when `webUrl` is set and rendered as plain text when it is not.
- [x] 2.2 Citation lists, the recent-changes table, the rework panel, the escapes panel, the out-of-band
      population panel, and the unmerged queue table all render through it.

## 3. Visualizations and presentation

- [x] 3.1 Inline-SVG charts computed from the projection: merge activity per day, lines changed per recent
      change, unmerged queue age per pull request, most-reworked files, and proportional bars in the spend
      tables; the distribution chart gains a scale with gridlines.
- [x] 3.2 Presentation pass: header band, trust chips, sorted and aligned tables, and an accent scale that
      holds in light and dark schemes and at phone width, with no hard-coded color outside the custom
      properties.

## 4. Documentation

- [x] 4.1 README and `docs/methodology.md` describe the linked citations and the `webUrl` derivation,
      including that a non-GitHub or local registry URL renders unlinked.
- [x] 4.2 `plans/roadmap.md`: this change as a phase one addendum.

## 5. Verification

- [x] 5.1 Test: a citation renders the change subject beside the hash, and links to
      `https://github.com/<owner>/<repo>/commit/<id>` when the repository has a `webUrl`.
- [x] 5.2 Test: with `webUrl` null (the local-path fixture registry), the same citations render the subject
      and the hash with no anchor, and the page contains no `href`.
- [x] 5.3 Test: self-containment as loaded resources — no `<script`, no `<link`, no `src=`, no `url(` or
      `@import` in the style block — and every anchor on the page points at the repository's own `webUrl`.
- [x] 5.4 Test: `webUrl()` resolves the SSH, `ssh://`, and HTTPS forms and returns `null` for a local path;
      the projection records it and a subject containing HTML is still escaped inside a linked citation.
- [x] 5.5 `npm run check` passes (2026-09-17, on this branch).
- [x] 5.6 End to end: `telemetry rebuild` then `telemetry board --html`, opened from a file URL, showing the
      charts, the linked citations, the dark scheme, and phone width; record the result in the PR.
      Evidence (2026-09-17): `./scripts/telemetry.sh sync`, `rebuild` (projection sha256
      3762b0ff…, schema 2), and `board --html` over `dev-ledger` wrote a page with no script and no loaded
      resource, served from a static file server and viewed at desktop width in light and dark schemes and
      at 375 pixels wide. The merge-frequency columns, distribution bars with scale, batch-size added and
      removed columns, queue age bars, reworked-file meters, and spend meters all rendered; expanding
      `changes: 13` under Wait time showed each citation as the abbreviated hash beside its subject
      (`1a1c578d5d` next to "Merge pull request #1 from salzayat/feat/workspace-foundation"), linking to
      `https://github.com/salzayat/dev-ledger/commit/…`; the recent-changes table linked every hash and
      pull request; the grid collapsed to one column at phone width.
