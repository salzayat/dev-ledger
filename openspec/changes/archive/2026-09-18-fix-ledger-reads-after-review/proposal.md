# Fix Ledger Reads After Review

## Why

A review of the fourteen pull requests from #26 to #39 against the published ledger found five things the
page said that were not what happened, and one thing the process let happen. Work mix read 61% `other`
because a merge commit carries git's subject and no type. Flow efficiency read 200% typical because the
earliest session records carry hand-typed start and end times. Rework read 754 pairs led by the roadmap,
the README, and the methodology, which every change in a spec-driven repository edits by design. The
page's footer still said "Nothing here is keyed to a person" after the operator became a dimension. And the
five newest changes read `undeclared` because their pull requests were opened with no session active and
nothing declared, which the tooling permitted without a word.

## What Changes

- A change merged by a merge commit takes its work mix type from the most common type among its branch
  commits, a telemetry record commit not voting; `other` is left for changes whose commits carry no type.
- `telemetry session start` records the clock alongside the identifier, and `telemetry session end` fills
  `startedAt` from it and `endedAt` from its own clock when the payload omits them, so a record's window is
  the one the commands saw. A payload that states its times keeps them.
- `scripts/pr.sh` refuses to open a pull request when no session is active, the branch declares nothing,
  and no commit on it carries a `Session:` trailer, unless `--allow-undeclared` is passed.
- The published page's footer says nothing is resolved to a person, which is the accepted boundary.
- This repository's registry entry ignores the roadmap, the README, `docs/`, and `openspec/` for rework,
  so the pairs that remain are in code. The methodology says how spec lead time depends on the trail.

## Dependencies

None. `add-flow-efficiency-and-work-mix` and `fix-session-none-default` are archived.

## Non-Goals

- No rewrite of existing records. The records with hand-typed times stand; the fix is for records written
  from now on.
- No change to spec lead time's definition. A spec drafted and archived in one pull request measures one
  cycle, and that is a fact about the process, now stated in the methodology.
