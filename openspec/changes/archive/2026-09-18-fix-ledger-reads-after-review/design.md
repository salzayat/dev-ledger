# Design: Fix Ledger Reads After Review

## A merge commit's type comes from what it merged

Git writes a merge commit's subject, and `Merge pull request #12 from ...` parses to no type. The branch
commits it brought in are the work, and each carries a type the hook validated. The change takes the most
common of those, ties going to the earliest, and a `chore(telemetry): record session` commit does not vote,
because it is the record of the work and not the work. A squash merge and a rebase run already read their
own subjects. Only a change with no typed commit anywhere reads `other`, so `other` goes back to meaning
what the note says it means.

## The commands own the clock

A session file's window was a payload field, and a payload written by hand carries whatever the hand
typed. The two commands that bracket a session are the only things that know when it ran: `session start`
now records the time it was invoked, in the same local git configuration that holds the identifier, and
`session end` supplies its own time as the end and reads the recorded start when the payload omits them. A
payload that states its own times keeps them, because a harness that knows its window knows more than the
commands do. Both keys are cleared at session end, as the identifier already was.

## A pull request is not opened blind

The hook stopped defaulting `Session: none`, which was correct, and the result was pull requests whose
every commit reads `undeclared` because nothing told the operator they had forgotten to start a session.
`scripts/pr.sh` is the one place every pull request passes through, so it checks before staging: an active
session, a human-only declaration on the branch, or a prior commit on the branch carrying a `Session:`
trailer lets it proceed. `--allow-undeclared` opens it anyway, for the case where undeclared is the truth
and the operator means to record it as such.

## Rework ignores what the process edits

The default ignore list covers lockfiles and the telemetry directory, which is right for most repositories.
This one edits the roadmap, the README, the methodology, and a spec in nearly every change, because that is
what spec-driven means, and 754 pairs led by those files measured the process and not the code. The registry
entry's own list is the accepted mechanism, so this repository uses it; the default is unchanged.

## What is said, not changed

The footer wording follows the accepted operator requirement. Spec lead time's definition is right, and the
13-minute figure is what a repository that archives in the implementing pull request looks like; the
methodology now says so, so nobody reads it as a broken clock.
