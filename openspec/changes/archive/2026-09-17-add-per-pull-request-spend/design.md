# Design: Add Per Pull Request Spend

## The gate belongs in `add`, not at each call site

The defect is that one of two call sites forgot a check (`packages/flow/src/signals.ts:340` has it,
`packages/flow/src/signals.ts:417` does not). Repeating the check at the new per-pull-request site would
leave the same trap for the next reader, so `add()` (`packages/flow/src/signals.ts:139`) refuses a record
carrying `figuresMissing` and reports whether it counted it. A total can then only be built from records
with figures, whatever the call site, and the excluded counter is the caller's decision rather than its
responsibility to remember.

This keeps the two paths' _counting_ different where they legitimately differ: a merged change's excluded
record increments `spend.excluded.missingFigures`, which is a count of changes' records across the
repository, while an unmerged pull request's increments that pull request's own `missingFigures` and the
aggregate's. Only the "never zeroed" rule is made common.

## Per pull request, keyed by number as a string

`perUnmergedPullRequest` is keyed by the pull request number rendered as a string, because the projection
is canonical JSON with sorted keys (`packages/flow/src/projection.ts:65-84`) and a numeric key would sort
lexically anyway. The entry carries `pullRequest` as a number so a consumer never has to parse the key
back, which is the shape `perEffortUnit` already uses for its `unit`
(`packages/flow/src/signals.ts:318-322`).

Citations list every session record of that pull request, including the ones excluded for missing figures.
A citation is a pointer to evidence, not a claim that the evidence produced a number; a reader looking at
"figures missing" needs the record that says so more than a reader looking at a cost does.

## The queue table answers the question the queue raises

The unmerged queue already shows age, commits, and the oldest commit date for each open pull request
(`packages/flow/src/board-html.ts`, the queue panel). Cost belongs in that row rather than in a separate
panel: the reason to look at a five-day-old pull request is to decide what is stuck, and what it has
already cost is part of that. The aggregate panel stays, because a repository with many open pull requests
still wants one number, and it now states what it excluded.

The recent-changes table gets the same column from `spend.byChange`, which has been computed since
`add-flow-observability` and has never been rendered. A change with no entry there is not `$0.00`: it is
`undeclared`, `unreported`, or `figures missing`, and the cell says which, reusing the status the sessions
column already derives.

## Session identifiers link to their record

The changes table prints session identifiers as plain text today. The projection carries each record's
`path` (`packages/flow/src/sessions.ts:56-57`), so a map from identifier to path turns each one into a link
to the file on the default branch through the citation renderer `improve-board-presentation` added. A
record on an unmerged pull head has no path on the default branch and renders unlinked.
