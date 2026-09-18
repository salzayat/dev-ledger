# Design: Add Task Velocity

## The estimate that already exists

A story point is a declared, relative size made before the work, by the people doing it. A task in an
OpenSpec change is the same thing with a checkbox, and it already exists for every change in this
repository. Adding a weight to the task line (`~3`) makes the size explicit where it matters and costs
nothing where it does not: an unweighted task counts one and the read says how many were unweighted, so a
team that never weights anything gets tasks per week and a team that weights everything gets complexity.

## A completed task is a tick that was not there at the base

Reading `tasks.md` at each change's last commit and at its base, a task the change completed is one ticked
after and not before. Keying by change name rather than path means archiving, which moves a fully ticked
file, completes nothing. A task ticked in a draft that never merged is not counted, because only the
default branch is read.

## Why not diff size

Derived complexity from lines changed is available in the configuration and stays off. Lines measure
what was typed, not what was decided, and a lockfile bump would outweigh a design change.
