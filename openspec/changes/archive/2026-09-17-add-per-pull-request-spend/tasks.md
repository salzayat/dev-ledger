# Tasks: Add Per Pull Request Spend

## 1. Signals

- [x] 1.1 `add()` refuses a record carrying `figuresMissing` and reports whether it counted it; the merged
      path keeps incrementing `spend.excluded.missingFigures` and its local check outcome.
- [x] 1.2 `spend.unmergedPullRequests` excludes records with missing figures and gains an excluded count.
- [x] 1.3 `spend.perUnmergedPullRequest`: per pull request, `pullRequest`, its spend, `missingFigures`,
      `invalidSession`, and citations to every one of its session records including excluded ones.
- [x] 1.4 `PROJECTION_SCHEMA_VERSION` to 3.

## 2. The Board

- [x] 2.1 Queue table: cost, tokens, and sessions per pull request, "figures missing" where the records
      carry none, with each record cited and linked.
- [x] 2.2 Recent-changes table: spend per change from `spend.byChange`, with `undeclared`, `unreported`, or
      `figures missing` in place of a figure, and session identifiers linked to their record files.
- [x] 2.3 The aggregate unmerged-spend panel states its excluded count beside the figure.

## 3. Documentation

- [x] 3.1 `docs/methodology.md` and README describe per-pull-request spend and the missing-figures rule on
      unmerged work.
- [x] 3.2 `plans/roadmap.md`: this change as a phase one addendum.

## 4. Verification

- [x] 4.1 Test: a session record carrying `figuresMissing` on an unmerged pull head contributes no cost,
      no tokens, and no session to `unmergedPullRequests`, and is counted as excluded instead.
- [x] 4.2 Test: two records on one unmerged pull request, one with figures and one without, produce that
      pull request's spend from the first only, `missingFigures: 1`, and citations to both.
- [x] 4.3 Test: the queue table renders a pull request's cost, and renders "figures missing" rather than a
      currency figure when every record of that pull request lacks them.
- [x] 4.4 Test: the changes table renders spend per change and `undeclared` where the change declared no
      session.
- [x] 4.5 `npm run check` passes (2026-09-17, on this branch).
- [x] 4.6 End to end: `telemetry sync`, `rebuild`, and `board --html` over this repository, confirming the
      queue and changes tables against the projection's own records; record the result in the PR.
      Evidence (2026-09-17): projection sha256 `89ee3d49…` (schema 3). The rendered page's queue table
      carries `pull request, age, commits, spend, sessions, oldest commit, records`, with pull requests 5
      and 4 reading `no session record` and citing none, matching the projection, which holds no session
      for either. The recent-changes table carries a `spend` column reading `figures missing` for every
      change whose records lack figures — no `$0.00` anywhere — and lists each change's session
      identifiers linked to their record files.
