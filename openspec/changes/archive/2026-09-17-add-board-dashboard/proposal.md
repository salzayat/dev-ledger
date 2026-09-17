# Add Board Dashboard

## Why

Phase one shipped The Board as a terminal render (`packages/flow/src/board.ts`, `telemetry board`). The
accepted `flow-observability` requirement "The Board" names one read surface with a citation on every
figure, and the phase two change (`add-change-audit`) adds a governance view to that same surface. A
terminal print is not something an engineer opens to find a bottleneck, and it is not something a
governance view can be added to. Phase one is not complete until The Board is a dashboard.

## What Changes

- `telemetry board --html [path]` renders The Board as one self-contained static HTML page (default
  `.telemetry/board.html`): inline styles, inline SVG, no script, no external resource, readable from a
  file URL. The terminal render stays as `telemetry board`.
- The page shows, per repository and across the registry, the same figures the terminal render shows:
  cycle and wait time distributions, the unmerged queue, batch size, merge frequency, rework, escapes,
  local check outcomes, spend by spec, provider, model, and per effort unit, excluded counts, out-of-band
  and unreleased changes, moved tags, threshold signals, and unreachable repositories, plus the schema
  versions and the as-of time each repository was measured at.
- Every panel names its trust classes and excluded counts beside the figure and carries an expandable
  list of the changes or records it was computed from.
- The page works in light and dark schemes and at phone width, and renders an explicit empty state.
- `packages/flow/src/board-html.ts` with tests; README and methodology mention the page.

## Dependencies

None.

## Non-Goals

- No server, no live reload, no script on the page. The page is a function of the projection file.
- No figure keyed to a person, and no person offered as a dimension.
- No governance view; that is `add-change-audit`, which extends this page.
- No charting library. Distributions are inline SVG bars.
