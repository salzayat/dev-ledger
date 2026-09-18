# Add Task Velocity

## Why

Velocity read 0 story points per week over 40 changes, because nobody estimates story points and the
read refuses to count a missing estimate as zero. A velocity that needs an estimate nobody makes is a
blank panel with a good excuse. The repository already holds an estimate made in advance of the work: every
change's `tasks.md`, whose boxes are ticked as the work lands.

## What Changes

- A task line may carry a relative complexity: `- [x] 1.2 ~3 ...`. An unweighted task counts one and is
  reported as unweighted, never guessed heavier.
- Each change records the tasks it completed: ticked at its last commit and not at its base, keyed by
  change name so an archive move ticks nothing.
- Velocity is the summed complexity of completed tasks per week, with tasks per week and changes per week
  beside it; story points remain as a figure where recorded. The Ledger's velocity panel and chart show
  complexity.
- `PROJECTION_SCHEMA_VERSION` is unchanged in shape; the change record gains a `tasks` field and the
  weekly bucket gains `tasks`, `complexity`, and `unweightedTasks`.

## Dependencies

None.

## Non-Goals

- No estimation by an agent, and no derived complexity from diff size; a weight is declared by whoever
  wrote the task.
- No velocity per operator or per person.
