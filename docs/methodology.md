# Methodology

What the numbers on The Ledger mean, where they come from, and what they cannot see.

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

The Ledger never shows an average, because one very slow change would drag it. Each timing panel shows
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

## The Ledger is a page rendered from the projection

`telemetry ledger --html` writes one self-contained HTML page from the projection: inline styles, inline
SVG charts, no script, and no loaded resource. Each repository opens with a summary strip (typical wait and
cycle, queue, merges per day, spend, out-of-band), then the panels, then a table of the newest changes with
each one's pull request, wait, cycle, lines, session status, and gaps. The charts — merges per day over the
measured window, the distribution bars, lines added and removed per recent change, queue age per pull
request, the most-reworked files, and the spend bars — are folds over the same records, computed when the
page is rendered. Nothing on the page can compute a figure the projection does not hold, so the citation
rule holds for the page as well as for the data.

## Two rates, never one

A metered provider reports its own cost, so dividing it by its own tokens involves no assumption: that rate
carries `reported`. A subscription's rate divides an amount apportioned by agent run seconds, so it inherits
that basis and carries `allocated`. Both are shown and neither is summed with the other — a measured cost and
a consequence of an allocation choice are different kinds of number.

Neither shares a denominator across providers. Providers do not count tokens the same way, so a combined
rate would divide by a quantity with no single meaning.

## Cache reads and cache writes

`cachedTokens` was one number defined as reads plus writes, which is one provider's shape. A provider that
reports only cache hits has no write figure, and recording a zero for it would claim it wrote nothing — a
reading it never made. Reads and writes are now recorded apart when a harness reports them apart, the
combined figure stays for every record already committed, and a read including such a record says its
components are unknown rather than implying a split it does not have.

## Currency lives in a field

`costUsd` was defensible while every record came from one plan in one currency. The allocation has been
multi-currency for a while; the reported figure was the last part that was not. A record may now carry its
cost with a currency, the historical field is read as USD so every committed record stays valid, and a record
carrying both with different values is rejected — one session reports one cost, not two.

## Configuration is local; the ledger is published

The published page carries no subscription configuration: not the declarations, not the gaps between them
and the records, not the remedies that name files to edit, and no control that writes. Configuration names
plan identifiers, the periods they cover, and the files that hold them, and the published page is world
readable.

What the published page does keep is the spend it exists to publish. The allocation panel still names the
plan and cites the cost record its figures came from, because that is the record behind a published figure
rather than a setting.

`telemetry configure` serves the configuration surface from the working copy on the loopback interface, and
refuses to bind anything else. Its security model is that it is not on the network; there is no password
because it grants no authority the shell that started it does not already have, and what it must never do is
offer that authority to anyone else.

The absence on the published page is containment, not hiding. The editor's markup lives in a module the
published renderer never imports, so there is no disabled form to re-enable and no hidden element to reveal
by reading the source.

It writes plan declarations and subscription cost records and refuses every other path, including one that
would escape the working copy. It never commits, stages, or runs git: the file changes, `git status` shows
what, and a person reviews the diff. Session records, the projection, and anything the harness wrote stay
unwritable, because a web page that could edit those would make every figure downstream unfalsifiable.

## A declaration is an intention; a record is what happened

A plan declaration says what a plan is arranged to cost. A period record says what was actually paid. They
are different kinds of fact, and holding both in one file would make a rate change indistinguishable from a
typo.

`subscription close` proposes the period's records from the declarations and stops. It does not commit,
deliberately: only a person knows what came off the card, and months differ — a credit, a proration, a seat
added on the nineteenth. A projection that generated figures from declarations alone would assert months of
spend nobody checked, which is the shape of the `Session: none` defect this repository has already met once,
where an unset variable became a claim about who did the work. The commit is where a person confirms the
figure, and the committed record remains the only thing any read trusts.

The Ledger reports the gaps between declarations, records, and the sessions that cite them — a declared plan
with no record for a closed period, a record no declaration covers, a session naming a plan with no record,
and a period no interval covers — each beside the command that closes it. It reports and never repairs: the
published page reads only from the projection and carries no form, so there is nothing to submit.

## Work mix

Each week's changes by the conventional commit type on their subject, with `other` for a subject that does
not parse. A week of fixes and a week of features are the same count and a different story, and the mix is
what tells them apart. A merge commit's subject is git's own and carries no type, so a change merged that
way takes the most common type among the branch commits it brought in, with a telemetry record commit not
voting; only a change whose commits carry no type at all reads `other`.

## Flow efficiency

Per change, the agent's run seconds plus the operator's active seconds, divided by cycle time: how much of
the elapsed time anyone was actually working. Changes with no timing, no sessions, or no active figures are
excluded by reason rather than read as nought per cent busy.

A record holds totals, not a timeline, so a session's active time is spread evenly over its own window and
only the part overlapping the change's cycle window counts. What falls outside is reported as worked
outside the window, never hidden and never folded in, and the figure cannot exceed one. Since
`session start` began recording the clock and `session end` filling the times from it, a record's window
is the one the commands saw.

## Iterations

Sessions per change and commits per change, as distributions. How many attempts a change took, which is the
question behind "is this getting harder".

## Older than

Unmerged pull heads past a registered age, with their spend. Labelled as older than that age, never as
abandoned or closed: git does not record whether a pull request was closed, only that its head is not
merged, and the tool does not guess the difference.

## Spec lead time

From the earliest commit citing a `Spec:` to the merge that archived that spec: an idea's whole life, not
just its final pull request. A spec still open has no end yet and is excluded as `open`; one whose changes
carry no pull head timing is excluded as `untimed`. The clock starts at the earlier of the first commit
carrying the trailer and the first appearance of the change's `proposal.md`, which git observed and which
predates any implementation; a spec drafted and archived in one pull request still measures one cycle.

## Cost per change and per release

Cost per merged change, per released change, and per release, each stating the changes it could not measure.
Where every contributing session is a subscription session, reported cost is zero by rule, so the figure
reads in tokens and says so rather than printing a currency amount that would be false.

## Check compliance

The share of changes that recorded a local check outcome, and the pass rate among those that did. The share
leads deliberately: a pass rate over a tenth of the changes says very little, and reporting the rate alone
would invite reading it as if it covered everything.

## The rework ignore list

A rework pair is two changes touching the same file inside the window. Without an ignore list the count is
dominated by lockfiles and generated files — churn nobody chose — and reads as noise. Each registry entry
carries globs whose files never make a pair, defaulting to the usual lockfiles and generated directories,
and the read states how many pairs the list removed. An entry naming its own list replaces the default
rather than extending it, so a repository that wants that churn counted can say so.

## Velocity, and what it is not

Velocity needs a size declared before the work, and the repository already holds one: every change's
`tasks.md`. A task line may carry a relative complexity after its identifier (`- [x] 1.2 ~3 ...`), and a
change completes the tasks that are ticked at its last commit and were not at its base, keyed by change
name so that archiving a list completes nothing. The Ledger reports the summed complexity of completed
tasks per week, with tasks and changes per week beside it. An unweighted task counts one and the panel says
how many were unweighted, never guessing a weight. Story points per week remain where a change recorded
them, with the changes that recorded none excluded and counted.

It is per repository and per week. There is no velocity per operator and there will not be: the operator
dimension exists to compare agent labour with human labour on the same change, not to rank people by
throughput, and a per-person velocity is the one figure this methodology was built to avoid producing.

## Tabs, and why they carry no script

The Ledger groups its panels into four tabs — flow, DORA, spend, and records — navigated by a fragment per
tab and selected with CSS. The page carries no script element, loads no external resource, and contains no
form control, so tabs could not be built from either of the usual techniques. The fragment approach has a
property the others lack: a tab is a URL, so a link to the DORA tab opens the DORA tab, and a figure stays
citable in a review.

DORA and flow are separate because they answer different questions. The four keys are approximations named
as such on every card; the flow signals are computed directly. One scroll had been quietly inviting a reader
to trust both equally.

## A citation names its change and reaches the commit

Every cited commit renders as its abbreviated hash beside that change's subject, so a citation reads as a
change rather than as ten hexadecimal characters. The hash links to the commit on the hosting platform,
a cited pull request to the pull request, and a cited session record to that file on the default branch.

The link target comes from the registry: `rebuild` resolves each repository's `url` to a web URL when it is
a GitHub remote (`git@github.com:owner/repo.git`, `ssh://`, or HTTPS, including a GitHub Enterprise host)
and records that URL in the projection. A local path or any other remote resolves to null, no local path is
ever written into the projection, and the same citations then render with the subject and the hash and no
link. A remote whose host is an SSH alias (`git@github.com-work:owner/repo.git`) is not a host anyone can
browse, so it resolves to null as well; the entry names its browsable URL in `webUrl` instead, and that URL
is recorded in place of the derivation. A link is navigation, not a resource: the page still opens from a file URL and loads nothing.

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

## Subscription cost is a period record

A subscription session has no marginal cost, and its record says so: `costUsd` is zero and stays zero.
What the plan cost is a fact of the billing period, so the period is the record: `telemetry subscription
record` writes what a plan cost for a month, in its currency, with any overage apart. The projection joins
each record to the sessions that ended in that month on that plan and apportions the amount by agent run
seconds, because tokens are dominated by cache reads and an even split would charge a ten-minute session
and a two-hour one the same.

The result is a third trust class, `allocated`: weaker than `reported`, because it is arithmetic over an
operator-entered amount and a basis this repository chose, and every allocated figure names that basis and
cites the period record. A session with no agent seconds takes no share and is counted, never given zero;
a period in which no session has any is reported as unallocated; a session whose period has no record is
counted as lacking one. A month that has not closed, as of the newest commit the mirror holds, is
provisional, because a change merged early in it holds a larger share than it will once the rest of the
month's sessions land. Two currencies are never summed.

## Where measurement starts, and what only an operator knows

A registry entry may declare `measuredFrom`. Changes merged before it predate the instrumentation and are
excluded from every signal with that reason, so coverage counts the period the tool was present for rather
than reporting a template's history as gaps; the projection still records them. An entry may also declare
`closedPullRequests`: git cannot see that a pull request was closed, so an operator says so and the pull
head leaves the queue with that reason.

## Notes are records

An explanation of a figure belongs beside it, under the same rules as every other record. A note names a
read and optionally a period, carries text and a date, is committed under `.telemetry/notes/`, and renders
on the records tab citing its file. It explains a number and never changes one.

## Hours are windowed, and a missing identifier is a label

Operator hours come from the transcript events between the session's recorded start and its end, so a
transcript kept across sessions never charges one the day's hours. Hours measured without a configured
operator identifier are shown under `(no operator identifier)` rather than dropped; `session end` prints
the command that sets one.

## Timesheets: measured, then confirmed

Hours are shown by operator, spec, and month from each record's operator active seconds. For billing, the
measurement is proposed and a person confirms it: `timesheet close <YYYY-MM>` writes one sheet per operator
from the month's records, with the measured hours by spec kept beside a confirmed column the operator
edits before committing. The panel shows both, so a correction is visible. No sheet can hold a rate.

## Unit economics in two columns

Every cost-per figure carries reported cost and allocated cost side by side and never sums them. On a
subscription the reported column reads zero and the allocated column carries the number. The units include
`tasks` and `taskComplexity` from each change's task list, so cost per unit of declared work needs no
story points. The terminal render prints both columns on each cost-per line.

## Across the registry, and the period statement

The rollup folds every reachable repository's signals over the same keys: spec to spec, class to class,
operator to operator, reported and allocated apart, hours as hours. It renders only when there is more
than one repository. `telemetry export --period YYYY-MM` writes the month as rows: allocations and hours
are period facts, classes, specs, and velocity are window facts, and each row says which and names its
trust class, so a spreadsheet never adds the two kinds by accident.

## A zero is a measurement, never an absence

Missing figures are counted, never read as zero, and the page holds itself to the same rule. A reported
cost on a subscription is fixed at zero by the contract, so it reads "none reported" and the tokens lead;
the spend chart leads with the allocated share and says so. Hours nobody has confirmed, exclusions that did
not happen, and units no change recorded read as absence in words. The one zero the page prints as a
count is a measurement: none, as in no escapes after the release.

## Signals, not findings

A signal is a read that crossed a threshold declared in `registry.json`, with the changes behind it. It
has no state and nobody acknowledges it. Rules, findings, exceptions, and evidence packs are phase two.

## What the plan worked out to per token

The Ledger divides an allocated period's amount by the input and output tokens of the sessions that took a
share of it. Input plus output leads because those are the tokens the work asked for. Cache reads are
reported beside it and never added to that denominator: over this repository's own September records they
run 892,856,906 against 3,440,144, so a combined denominator reads about two hundred and sixty times better
and moves with how long a context stayed warm rather than with how much was asked for.

It is not a price and not a fraction of the subscription. A plan costs what it costs and has no token
component; this is what the amount worked out to, over the records that produced it. Sessions that took a
share and reported no tokens are counted on the figure, because they raise the rate without being visible in
it, and a period with no tokens behind it reports no rate rather than a rate of zero.

## Nothing resolved to a person

The Ledger reads by change, spec, repository, provider, model, and operator. An operator is either an agent,
identified by its provider and model, or a human, identified by a pseudonymous identifier. Both are
measured, because the question this tool exists to answer is how agent labour and human labour divide across
a change, and you cannot see that division while instrumenting one side of it.

The two are measured in different units on purpose. An agent's consumption of a paid plan is denominated in
the currency the plan is billed in. A human's effort is denominated in hours, from `operatorActiveSeconds`
under its idle cap — the time they spent working the thread, derived from their own prompts in the session
transcript, with the agent's autonomous runs and the thread's idle stretches attributed away from them —
and is never multiplied by a rate. Man hours are reported beside tokens as a second expense, per change
and per unmerged pull request, in hours and never in money. No record in this repository can hold one: `rate`,
`hourlyRate`, `salary`, and `compensation` are rejected by the session schema, so there is nothing to
convert hours into money with, and the two figures are never summed.

What stays true is the boundary that always did the work. No read resolves an identifier to a name or an
email address; the schema refuses to record either. The audience for this tool is the engineers being
measured, and a figure they can check is worth more to them than a figure withheld.

## The merge message setting

The projection reads trailers from the squash or merge commit message first. GitHub's "Default to pull
request title and description" setting for squash and merge messages carries the trailers `scripts/pr.sh`
writes into the description onto that commit. Without it, trailers come only from the branch commits,
which still works for merge commits and rebase merges; for a squash merge whose message drops them, the
change reads as undeclared.

## DORA, approximated to the release tag

The four DORA keys are defined against deployments, and git holds releases, not deployments. The Ledger
shows all four anyway, each computed to the release tag and labeled that way:

- Deployment frequency is release tags per week over the measured window.
- Lead time for changes runs from a change's first commit to the tag that carried it; the merge-to-tag
  part is shown separately so a slow release cadence is not mistaken for slow review.
- Change failure rate is escapes (reverts and fixes after the newest release touching released files) per
  release, with the denominator printed beside it.
- Time to restore is shown as time to fix: from the merge of the released change an escape targets to the
  merge of the escape. A fix targets the most recent released change it shares a file with.

A team that deploys every tag reads these as they stand. A team that does not reads the note. Phase two's
collector replaces the tag with a deployment record without changing the shape of the read.

## Cost by class, declared at the spec

A class is a property of the work, and the work is named by its spec, so a class is declared once per spec
with `telemetry class set <spec> <class>` and inherited by every change and session citing it. A session's
own class wins, then the change's `Cost-Class:` trailer, then the spec's declaration; anything else is
`unclassified` and never defaulted. The panel shows reported cost, the allocated share, and operator hours
per class, because planning and tax credits count dollars and hours, and says how many records resolved
by each source.

## Trends

Merge activity and spend share one set of weekly buckets, starting on the Monday of the first merge, so
throughput and cost can be read side by side.

## What this does not see

Reviews, approvals, check outcomes, pull request open and close times, and whether an unmerged pull
request is open or closed. Git does not hold them. Phase two adds them through an optional collector and
says, for every control that needs them, when they were not observed.
