# Design: Refine Ledger After Review

## The harness runs the lifecycle

Undeclared changes, hand-typed times, and out-of-order records all came from memory. Claude Code fires
`SessionStart` and `SessionEnd` with the session identifier and transcript path on stdin, so one script
starts the session on the first and ends it on the second. Everything a record needs is derivable at that
point: the model from the transcript's newest assistant record, the plan and provider from `plans.json`,
the commits from the branch since the recorded start carrying the session's trailer, the local check as
`not-run` because the hook does not run it. A record made this way says so in `figuresSource`.

## Two gates, one message

`pr.sh` guards people who use it; the workflow guards everyone. `check-declared.sh` fails a pull request
whose range carries no `Session:` trailer and whose body neither names a session nor carries
`Session: undeclared`, which `--allow-undeclared` now writes. Both print the same three ways forward.

## Atomic and loud

`session end` wrote, committed, then unset. A failed commit left the record staged and the session active,
and the first complaint came from the push hook a day later. Now a failed commit removes the record,
leaves the session active, and prints the hook's stderr.

## Reads that measure the code

The proposal file is git-observed and precedes any trailer, so spec lead time starts there when earlier.
A session record holds totals, not a timeline, so active time is spread evenly over the session's own
window and only the overlap with the cycle window counts; the remainder is a second figure, never hidden
and never clamped away. `measuredFrom` is a per-entry fact about when the instrumentation began, and a
change before it is excluded by that reason rather than counted as a gap. A closed pull request is
something only an operator knows, so the registry carries it as a declaration.

## Notes are records

An explanation of a figure belongs beside the figure, under the same rules as every other record: written
by an operator, dated, committed, cited, never edited in place. `.telemetry/notes/<id>.json` names the
figure and optionally a period; the page renders them on the records tab. The README stops carrying them.
