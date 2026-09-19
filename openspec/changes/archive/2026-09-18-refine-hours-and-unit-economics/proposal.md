# Refine Hours And Unit Economics

## Why

Three things on the published page were wrong or blank. Operator hours read "none recorded" while the
newest records carried four to five hours each: the identifier was never configured, so the hours were
excluded, and the figures were inflated anyway because every record attributed the whole transcript
rather than its own session. Cost per unit of effort divided reported spend, which is $0.00 on a
subscription, so unit economics read zero over real work, and the units on offer were story points nobody
records. And the summary strip clipped at ordinary widths, marking provisional figures with a bare `~`.

## What Changes

- Operator hours are attributed from the transcript events inside the session's own window, from the
  recorded start to the end. `session end` warns when cost allocation is enabled and no operator is
  configured, naming the command that sets one.
- Hours recorded without an identifier stay on the page under one label saying the identifier is missing,
  rather than vanishing into an excluded count.
- Unit economics carry an allocated figure beside the reported one: cost per unit, per merged change, per
  released change, and per release, in the allocation's currency. Two new units come from each change's
  task list, `tasks` and `taskComplexity`, so cost per unit of declared work needs no story points.
- The Ledger's strip leads with allocated spend, labels reported spend as such, says "provisional" in
  words, and no longer clips; the effort table shows allocated and reported per unit side by side.

## Dependencies

`add-task-velocity` (archived), for the tasks a change completed.

## Non-Goals

- No rate, no conversion of hours to money. Hours and currency stay in separate columns.
- No rewrite of existing records; records with inflated hours stand, and a note on the page says so.
