# Add Per Pull Request Spend

## Why

Spend on unmerged work is gated differently from spend on merged work, and the difference produces exactly
the zeroed figure the contract forbids.

For a merged change, a session record carrying `figuresMissing` is skipped and counted:
`spend.excluded.missingFigures += 1` (`packages/flow/src/signals.ts:340-345`). For an unmerged pull
request, every record with a file is added unconditionally (`packages/flow/src/signals.ts:416-420`), with no
`figuresMissing` check. A repository whose harness never supplied figures therefore reads
"Spend on unmerged pull requests: $0.00 over 1 sessions" — a reported $0.00 standing in for an unknown
figure, against the accepted requirement that such a record is "excluded from every cost and token figure
with their counts stated" and "SHALL NOT be counted as zero" (`openspec/specs/flow-observability/spec.md`,
Requirement: Session declarations, and missing records counted rather than zeroed). It is observable today
on this repository's own Board.

The same panel is also the only place unmerged spend appears, and it is one number across every open pull
request. `spend.byChange` exists for merged changes (`packages/flow/src/signals.ts:359`) but nothing on The
Board reads it, and there is no per-pull-request equivalent, so neither the queue table nor the
recent-changes table can answer "what did this pull request cost" — the question the queue is there to
raise.

## What Changes

- Spend on an unmerged pull request skips a record carrying `figuresMissing` and counts it, matching the
  merged path. The aggregate panel states its excluded count beside the figure.
- `signals.spend.perUnmergedPullRequest`: per pull request number, its spend, the number of its records
  excluded for missing figures or for being unreadable, and citations to every one of its session records
  including the excluded ones.
- The Board's unmerged queue table gains the cost, tokens, and session count of each pull request, with
  "figures missing" in place of a figure when that is what the records say, and each session record linked.
- The Board's recent-changes table gains the same column per change, read from `spend.byChange`, and links
  each session identifier to its record file on the default branch.
- `PROJECTION_SCHEMA_VERSION` goes to 3.

## Dependencies

`improve-board-presentation` (archived): this change adds columns to the tables and the citation renderer
that change introduced.

## Non-Goals

- No new record and no new collection. Every figure here is a fold over session records the projection
  already holds.
- No change to how a session is attributed to a change or to a pull request
  (`packages/flow/src/sessions.ts`); only how its figures are totalled and rendered.
- No local check outcomes from unmerged pull requests. Today `localChecks` counts only sessions of merged
  changes; changing that is a separate question about what an unshipped check outcome means.
- No figure keyed to a person, and no person offered as a dimension or as a link target.
- No estimate, no imputation, and no substitute for a missing figure. A pull request whose records carry
  no figures reads as "figures missing", never as `$0.00`.
