# Tasks: Add Task Velocity

- [x] 1.1 ~3 `packages/flow/src/tasks.ts`: parse task lines with an optional `~N` weight; completed tasks
      between two versions of a list, keyed by change name with the archive prefix removed.
- [x] 1.2 ~2 `packages/flow/src/projection.ts`: each change's completed tasks from its base and last commit.
- [x] 1.3 ~3 `packages/flow/src/signals.ts`: weekly `tasks`, `complexity`, `unweightedTasks`; velocity as
      complexity per week with tasks and changes beside it.
- [x] 1.4 ~2 The Ledger: the velocity figure and chart show complexity; the note states unweighted tasks.
- [x] 2.1 ~1 Docs: methodology "Velocity", contract fields, README line, roadmap row; this task list weighted.
- [x] 3.1 ~2 Test: a drafted, worked, and archived list yields 3 tasks, complexity 9, one unweighted, and an
      archive move completing nothing.
- [x] 3.2 ~1 `npm run check`; a rebuild over this repository recorded in the pull request. Evidence
      (2026-09-18): sha256 `8d718bb7…`; velocity 315 complexity per week over 1 week, 315 tasks completed,
      all 315 unweighted (this change's list is the first weighted one), 40 changes per week.
