# Refine Ledger After Review

## Why

Most of this week's defects came from one cause: a person had to remember a four-step session lifecycle,
and when they did not, the tooling said nothing. The rest were reads that measured the process instead of
the code: spec lead time starting at the first trailer rather than the proposal, flow efficiency counting
active time outside the change's window, coverage counting template history as gaps, a queue holding a
pull request everyone knew was closed, and a README explaining figures a page could not explain itself.

## What Changes

- A Claude Code hook adapter (`scripts/harness/claude-code.sh`, wired in `.claude/settings.json`) runs
  `session start` on `SessionStart` and `session end --transcript` on `SessionEnd`, deriving the model
  from the transcript, the plan from the declarations, and the commits from the branch.
- The ledger workflow fails a pull request whose commits carry no `Session:` trailer and whose body
  declares nothing; `scripts/pr.sh --allow-undeclared` writes `Session: undeclared` so the override is
  visible to it.
- `session end` is atomic: if the record commit fails, the record is removed, the session stays active,
  and the hook's own error is printed.
- Spec lead time starts at the first appearance of the change's `proposal.md` when that is earlier than
  the first trailer.
- Flow efficiency counts only the active time whose session window overlaps the cycle window, spread
  evenly over the session, and reports the rest as worked outside the window.
- A registry entry may declare `measuredFrom`, excluding changes merged before it with that reason, and
  `closedPullRequests`, which leave the queue with that reason.
- Operator notes are records under `.telemetry/notes/`, written by `telemetry note add`, rendered on the
  records tab dated and cited. The README's explanations of this repository's figures move there.
- The README is cut to what a first-time reader needs.

## Dependencies

None.

## Non-Goals

- No rewrite of existing records; no backfill of times.
- No other harness adapter yet; the script's shape is the template for one.
