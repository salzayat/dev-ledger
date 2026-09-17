# Methodology

What the numbers on The Board mean, where they come from, and what they cannot see.

## A change, not a commit

The unit of measurement is the change: what one pull request put on the default branch. On first-parent
history a squash merge is one commit, a merge commit brings its branch commits in through the second
parent, and a rebase merge is a run of single-parent commits tied together by the `Change:` trailer the
commit hook writes once per branch. A single-parent commit with no `Change:` trailer is its own change.
Trailers are read from the merge or squash message when it carries them, and otherwise from the union of
the branch commits' trailers; a single-valued trailer that disagrees across commits is a
`conflicting-trailer` gap and reads as absent.

## Association, and its limits

Nothing here reads the hosting platform. A change is associated with a pull request by the number in a
squash or merge subject, by a pull head ref (`refs/pull/N/head`) whose tip sits inside the change, or by
patch identity between the change's commits and the commits on a pull head ref. The method used is
recorded on every change. A change that matches none of them is `out-of-band`: a direct push, or a merge
made without the platform's refs available. A subject number is unique only within one repository, and a
fork inherits squash subjects that name the upstream repository's pull requests, so a pull head stays in
the unmerged queue unless a merge naming its number happened after its commits existed. That is weaker than the platform's own record, and it is
enough for the question this repository answers, which is where work waits.

## Timing comes from the pull head ref

A squash collapses a branch into one commit stamped with the merge time. A rebase merge rewrites every
commit's committer date to the moment of merge. Read from the default branch alone, wait time collapses to
zero. The pull head ref keeps the original commits with their author dates, so:

- cycle time is the interval from the earliest author date on the pull head's branch commits to the
  merge commit's committer date;
- wait time is the interval from the latest author date on those commits to the merge.

The merge time is the merging party's clock, and the projection says so. A change with no pull head ref
has both figures absent with a reason, never zero.

## Undeclared, unreported, human-only

A change with no `Session:` trailer anywhere is `undeclared` (an `undeclared-session` gap). A change that
names a session whose file is not in the tree at its last commit is `unreported` (a
`missing-session-record` gap). A change whose commits carry `Session: none` is human-only work, declared
and complete. Undeclared and unreported changes are excluded from every spend figure and counted beside it.
Nothing is read as free.

## Two trust classes

Git observed the commit graph and its dates: `observed`. The harness reported what a session spent:
`reported`. Every figure names the classes it was computed from, and no read promotes a reported figure
to observed. There is no third class here; platform facts belong to phase two's optional collector.

## The Board is a page rendered from the projection

`telemetry board --html` writes one self-contained HTML page from the projection: inline styles, inline
SVG bars for the distributions, no script, no external resource. Each repository opens with a summary strip
(wait and cycle p50, queue, merges per day, spend, out-of-band), then the panels, then a table of the newest
changes with each one's pull request, wait, cycle, lines, session status, and gaps. Nothing on the page can compute a figure
the projection does not hold, so the citation rule holds for the page as well as for the data.

## Signals, not findings

A signal is a read that crossed a threshold declared in `registry.json`, with the changes behind it. It
has no state and nobody acknowledges it. Rules, findings, exceptions, and evidence packs are phase two.

## Nothing keyed to a person

The Board reads by change, spec, repository, provider, and model. It never offers a person as a dimension.
The pseudonymous operator identifier exists only for cost allocation, is off by default, and no read here
uses it. The audience for this tool is the engineers being measured.

## The merge message setting

The projection reads trailers from the squash or merge commit message first. GitHub's "Default to pull
request title and description" setting for squash and merge messages carries the trailers `scripts/pr.sh`
writes into the description onto that commit. Without it, trailers come only from the branch commits,
which still works for merge commits and rebase merges; for a squash merge whose message drops them, the
change reads as undeclared.

## What this does not see

Reviews, approvals, check outcomes, pull request open and close times, and whether an unmerged pull
request is open or closed. Git does not hold them. Phase two adds them through an optional collector and
says, for every control that needs them, when they were not observed.
