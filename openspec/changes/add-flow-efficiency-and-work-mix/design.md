# Design: Add Flow Efficiency And Work Mix

## Work mix comes from the subject, not from a label

The commit hook already enforces `type(scope): summary` on every commit made through it, and a squash or
merge subject carries the type of the pull request's title. The change's type is read from its subject on
the default branch, and a subject that does not parse is `other`, never guessed from files. Per-week
buckets reuse the DORA addendum's Monday weeks so the work-mix chart sits under the merge-activity chart
with the same x axis.

## Flow efficiency needs both halves of the fraction

Flow efficiency is active time over elapsed time. Elapsed time is the change's cycle time from the pull
head ref. Active time is the sum over the change's sessions of `agentRunSeconds` plus
`operatorActiveSeconds` where the record carries them. A change whose sessions carry neither, whose sessions
are missing, or whose timing is absent is excluded with that reason. The read is a distribution over the
rest, labeled like the timing panels, and its note says which records counted. A value above one is
possible when sessions overlap or a session predates the first commit, and is reported as it stands rather
than clamped, with the change cited.

## Iterations are two distributions

Sessions per change and commits per change over the measured window. Commits per change already exists as
the batch-size median; this read gives it the typical, nine-in-ten, and slowest shape the timing panels
have, and adds sessions per change beside it. Both cite the changes at the tail.

## Abandonment is the queue, totaled past a threshold

The queue already lists each unmerged pull head with its age and its spend. Abandonment applies one
registered age (`abandonedAfterSeconds`, default thirty days) and totals what lies past it: count, spend,
tokens, and records without figures counted beside. Git cannot say whether a pull request is closed, so
the line says "older than" rather than "abandoned" and the note says why.

## Spec lead time uses this repository's own loop

A `Spec:` trailer names an OpenSpec change. Its first commit is the earliest author date of any commit
carrying that trailer, on the pull head refs where they exist; its end is the merge of the change that
adds the archive directory for that name. The interval is the spec's lead time. A spec with no archive
merge yet is excluded as `open`, and a spec whose commits carry no pull head timing is excluded as
`untimed`. This is the closest read git has to idea-to-production, and it is exact for a repository that
follows the OpenSpec loop.

## Three cost figures over what was measured

Cost per merged change divides measured spend by the changes with figures; cost per released change does
the same over changes carried by a release tag; cost per release divides measured spend on released changes
by the number of releases in the window. Each states the number of changes excluded for missing figures,
exactly as cost per unit of effort does. Cost stays a reported figure on a metered plan and zero on a
subscription, so on a subscription these read as tokens per change instead, and the label says which.

## Check compliance sits beside coverage

The share of changes with any `localCheck` outcome recorded, and the pass rate among those, over the
measured window. It is a leading read for change failure rate and belongs next to the coverage counts.

## Rework needs an ignore list

`rework.ignore` on a registry entry is a list of path globs excluded from rework pairing, with a default of
lockfiles and the telemetry session directory. A pair whose only shared files are ignored is dropped, and
the panel says how many pairs the list removed.

## What stays out

Anything that needs a review event, a check run, a deployment, or an incident. Every one of those is a
phase two read and is listed in `add-change-audit` as collector-dependent.
