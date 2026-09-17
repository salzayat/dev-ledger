# Tasks: Add Board Dashboard

## Package

- [x] 1.1 `packages/flow/src/board-html.ts`: `renderBoardHtml(projection)` returning one self-contained
      page (inline styles, inline SVG, no script, no external resource) with the header, per-repository
      sections, panels with trust classes, excluded counts, and citation lists, distribution bars, the
      queue, spend tables, signals, unreachable repositories, and the empty state; every text value escaped.
- [x] 1.2 `telemetry board --html [path]` writes the page (default `.telemetry/board.html`) and prints the
      path; `telemetry board` keeps the terminal render.
- [x] 1.3 Tests: empty state; a fixture projection renders every panel with citations; escaping; no
      `<script`, no external `http` reference, no person dimension; light and dark variables present.

## Documentation

- [x] 2.1 README quick start and key commands mention `board --html`; methodology names the page.
- [x] 2.2 `plans/roadmap.md`: this change as a phase one addendum, `In progress`.

## Verification

- [x] 3.1 `npm run check` passes (2026-09-17, run by the pre-commit hook on this branch's commits).
- [x] 3.2 End to end: render the page from the projection over `dev-ledger` and `binary-logic`, open it
      from a file URL in a browser, and confirm the panels, citations, dark scheme, and phone width.
      Evidence (2026-09-17): the page rendered from the projection over `dev-ledger` and `binary-logic` (59 KB, no
      script, no external resource) was served from a static file server and screenshotted at desktop width in
      light and dark schemes and at 375 pixels wide: every panel showed its trust badge, excluded note, figure,
      and expandable citations; the grid collapsed to one column on the phone width.
