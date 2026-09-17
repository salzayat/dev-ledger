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

## Typical, nine in ten, slowest

The Board never shows an average, because one very slow change would drag it. Each timing panel shows
three figures instead. Typical is the median: half the changes were faster than it, half slower. Nine in
ten is the value nine out of ten changes came in under, which is where a slow tail shows. Slowest is the
single worst change, always cited so it can be looked at. In the projection file these are `p50`, `p90`,
and `max`.

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
SVG charts, no script, and no loaded resource. Each repository opens with a summary strip (typical wait and
cycle, queue, merges per day, spend, out-of-band), then the panels, then a table of the newest changes with
each one's pull request, wait, cycle, lines, session status, and gaps. The charts — merges per day over the
measured window, the distribution bars, lines added and removed per recent change, queue age per pull
request, the most-reworked files, and the spend bars — are folds over the same records, computed when the
page is rendered. Nothing on the page can compute a figure the projection does not hold, so the citation
rule holds for the page as well as for the data.

## A citation names its change and reaches the commit

Every cited commit renders as its abbreviated hash beside that change's subject, so a citation reads as a
change rather than as ten hexadecimal characters. The hash links to the commit on the hosting platform,
a cited pull request to the pull request, and a cited session record to that file on the default branch.

The link target comes from the registry: `rebuild` resolves each repository's `url` to a web URL when it is
a GitHub remote (`git@github.com:owner/repo.git`, `ssh://`, or HTTPS, including a GitHub Enterprise host)
and records that URL in the projection. A local path or any other remote resolves to null, no local path is
ever written into the projection, and the same citations then render with the subject and the hash and no
link. A link is navigation, not a resource: the page still opens from a file URL and loads nothing.

## Spend on work that has not shipped

A session record found on an unmerged pull head ref is kept and attributed to that pull request, so work
that never ships keeps its cost. The unmerged queue shows each pull request's cost, tokens, and session
count beside its age, and the changes table shows the same per merged change.

Both obey one rule: a record whose harness supplied no figures is excluded and counted, never read as
zero. A pull request whose records all carry `figuresMissing` reads "figures missing" in its spend cell,
and a change that declared no session reads `undeclared` — neither is `$0.00`, because nobody measured
them. Every such row still cites the records behind it, including the ones excluded from its figures: the
record that says the figures are missing is the evidence for the claim.

## A pull request shows its own records

`scripts/pr.sh` puts the branch's session records into the description it opens, built by
`telemetry session summary` from git and the session files alone. The reviewer sees what the branch
recorded before deciding whether to merge it, and a record with no figures is named as missing there too.
The projection is not read: the pull request does not exist yet when its description is written.

## Where the token figures come from

Nothing here asks a provider what a session cost. A figure is either stated by the harness or summed from
the session's own transcript on this machine, and either way it is `reported`, never `observed`. Cost is
not derived: on a subscription the contract fixes `costUsd` at zero, so a subscription session reports real
token counts and no dollar figure, and that is the honest reading rather than a price guess.

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
