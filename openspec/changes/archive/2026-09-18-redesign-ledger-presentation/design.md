# Design: Redesign Ledger Presentation

## A second level of tabs is the same mechanism, not a new one

The page selects a tab with `:target` and marks the active link with `:has`
(`packages/flow/src/ledger-html.ts:1295-1316`), and hides the default tab with a sibling selector once
any other tab is targeted. A sub-view is a section with an id like `<repo>-heading-metrics-flow`; a
parent tab is on when `body:has()` any of its children targeted, and the parent's row of sub-links shows
under the same condition. The default view, Metrics › Flow, stays last in the document so the existing
`:target ~ .tab--default` rule keeps hiding it. A browser without `:has` loses the active marks and the
sub-row filter, and every link still opens its view, which is the same degradation the page has today.

## The figure leads; the panel helper reorders, the call sites do not move

Every panel is built by `panel(title, body, meta)` (`ledger-html.ts:428-436`), and every call site passes
`meta` as trust badges followed by prose. Rather than touching thirty call sites, `panel` splits the meta
into its badges and its prose, lifts the badges beside the title, moves the prose and every `<p
class="help">` in the body under one `<details>` labelled "How it's measured", and moves any citation
block that closes the body after it. Citations inside table cells are untouched because only a trailing
block is moved. The tests that look for `excluded: `, `badge-observed`, and `<details class="cites">`
keep matching because the strings are the same; only their position changes.

## Question groups replace one grid

The flow tab is one `.grid` (`ledger-html.ts:1219`). Each sub-view becomes a list of groups, each a
heading, a subtitle, and a grid with an explicit column count, so a panel's position says what it is
related to. Velocity, merge frequency, batch size, and work mix share the question "how much ships, and
how big?", so they leave Flow for Throughput; the spec's rule that flow signals and the DORA keys occupy
separate tabs holds because Flow, DORA, and Throughput are three sub-views.

## The headline composes; it does not compute

The sentence under the top bar names the typical wait, typical cycle, flow efficiency, and the period's
spend. Each is the same value the panel shows, formatted by the same helper, and each is a link to the
sub-view holding that panel, so a reader who doubts a number is one click from its trust class, its
excluded count, and its citations. The five figures beside it draw their trends from data the signals
already carry: the wait and cycle distributions (`p50`, `p90`, `max`), the queue's ages, the daily merge
buckets that `mergeActivity` already builds, and the weekly spend buckets. No new signal is computed.

## Why the schema versions move

They are the page's provenance, not its subject. The footer already states the methodology boundary;
the versions belong beside it. The top bar carries what a reader needs to know which repository, branch,
and instant the figures describe.

## Recent changes: fewer columns lead, none are removed

The spec requires the changes table to show each change's spend and cite every session record. Lines,
sessions, and gaps stay in the row inside a per-row `<details>`, so the leading columns fit without a
horizontal scroll at desktop width and the citations remain expandable beneath the figure, which is the
spec's own phrase for where they belong.
