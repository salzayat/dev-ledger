# Design: Improve Ledger Presentation

## Tabs are anchors and CSS, because the page may not contain a script or a form

The two usual ways to build tabs are both unavailable here. A script that toggles panels is forbidden
outright: the page contains "no script element and no external resource"
(`openspec/specs/flow-observability/spec.md:413`). The radio-and-label technique avoids script but puts form
controls in the page, which the configuration surface work has just committed to keeping out of the
published artifact so a deployment cannot be made to reveal an editor it never held.

What remains is the fragment. Each tab is a link to an identifier on the same page, and CSS selects the
panel whose identifier matches with `:target`. The default tab renders when no fragment is set, through a
sibling selector rather than a script. That keeps the page one file, openable from a `file:` URL, with no
control that submits anything and nothing to execute — and it has the property the others do not, that a tab
is a URL: a link to the DORA tab opens the DORA tab, which is what makes a figure citable in a review.

The cost is that selecting a tab writes a fragment into the address bar and adds a history entry. That is a
reasonable price for a page whose defining constraint is that it carries no code.

## Tabs organised by the question, not by the panel

The panels group into four questions a reader actually arrives with, and the tabs are those questions:

- **Flow** — how work moves: cycle and wait time, the queue, batch size, merge frequency, rework, escapes,
  and now velocity. The signals that describe delivery as a system.
- **DORA** — the four keys, approximated to the release tag, with the approximation named on each card. They
  sit alone because they answer a benchmarking question, not a diagnostic one, and mixing them into flow
  invites reading one as the other.
- **Spend** — what it cost: subscription allocation and its rate, spend by spec, provider, model, and
  operator, cost classes, and man hours. One unit question, one place.
- **Records** — what the figures are made of: the recent-changes table, the unmerged queue, coverage, gaps,
  and configuration. The traceability surface.

DORA and flow are separated because the request asked for it and because the separation is real: DORA's four
keys are approximations this repository names as such, and flow's signals are computed directly. Putting
them in one scroll has been quietly inviting a reader to trust both equally.

## Velocity is per week and per repository, never per person

Story points are already enabled, already carried on a `Story-Points:` trailer, and already read for cost
per unit of effort. Velocity divides the same points by the same weekly buckets the trends read uses, so it
introduces no new record and no new configuration.

It is computed per repository and per week, like every other flow read, and never keyed to an operator. That
is not caution about the operator dimension, which this repository now has; it is that velocity per person
is the metric this methodology exists to avoid, and the dimension it added exists to compare agent labour
with human labour, not to rank people by throughput.

Changes recording no points are excluded and counted, as cost per story point already excludes them
(`openspec/specs/flow-observability/spec.md`), so a window in which half the changes carried no points
reports the half it could measure and says how many it could not.

## The rename is complete rather than aliased

`telemetry board`, `npm run board`, `scripts/board.sh`, `board.yml`, and the `board-html` module are renamed
rather than duplicated behind aliases. This repository's own guidance is to implement the smallest
contract-covered slice and not to add speculative compatibility layers, and an alias for a command in a
pre-release repository with one operator is exactly that.

The accepted requirement is renamed through the delta's `RENAMED` section rather than removed and re-added,
so the requirement keeps its history and every scenario travels with it.
