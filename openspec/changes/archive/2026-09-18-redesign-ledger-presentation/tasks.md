# Tasks: Redesign Ledger Presentation

## 1. Structure

- [x] 1.1 ~5 Two-level tabs in `renderRepositoryHtml` and `tabNavRules`: Metrics (Flow, DORA,
      Throughput), Economics (Spend, Effort), Records (Changes, Queue, Notes); parent marks from `:has`
      over its children; default view last in the document.
- [x] 1.2 ~3 Question groups per sub-view with heading, subtitle, and an explicit column count; velocity,
      merge frequency, batch size, and work mix under Throughput; hours, operators, cost per unit, and
      unmerged spend under Effort.
- [x] 1.3 ~3 Headline: the sentence with linked figures and the five figures with trends, replacing the
      seven-stat strip; schema versions to the footer; trust legend and as-of in the top bar.

## 2. Panels and tables

- [x] 2.1 ~3 `panel` lifts trust badges beside the title, folds the meta prose and help text under "How
      it's measured", and moves a trailing citation block after it.
- [x] 2.2 ~2 Recent changes leads with merged, change, pull request, wait, cycle, spend, hours; lines,
      sessions, and gaps disclose per row.
- [x] 2.3 ~3 Stylesheet: flat bordered grids, hairline separators, headline strip as the one elevated
      object, two-level nav, both color schemes, phone width.

## 3. Documentation

- [x] 3.1 ~2 `docs/methodology.md` tabs section, `README.md` "What The Ledger shows", `plans/roadmap.md`
      row and prose.

## 4. Verification

- [x] 4.1 ~2 Test: eight sub-view fragments per repository, three parent links, flow and DORA in
      different sections, the default view last, no script, form, input, button, or select.
- [x] 4.2 ~2 Test: the headline sentence links each figure to the sub-view holding its panel, and the
      strip shows five figures with no `$0.00` and no schema version above the fold.
- [x] 4.3 ~2 Test: in every panel the figure precedes the methodology, the methodology is inside a
      `details`, and trailing citations follow it; table-cell citations are unmoved.
- [x] 4.4 ~1 `npm run check`; a rebuild over this repository with the page opened from a file URL, both
      color schemes, and a 400 pixel viewport, recorded in the pull request. Evidence (2026-09-18):
      `npm run check` passed; projection sha256 `54ad7a85…`; page 47 changes on main, wait 5 min, cycle
      13 min, flow efficiency 14%, spec lead time 15 min, $100.00 allocated provisional over 18 sessions
      with figures, queue 4; eight sub-views opened by fragment from `file:` and from a local server in light
      and dark schemes and at 375 pixels, sub-rows filtering to the current view.
