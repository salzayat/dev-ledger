# Design: Add Flow Observability

## Git over SSH is the whole data path

The earlier draft of this capability, written in the Binary Logic repository, had three workflows, a ledger
pull request that wrote platform facts back into the audited repository, and offline verification of the
platform's merge signatures for the case where the ledger was absent. Every one of those existed to get at
facts git does not hold: who reviewed, whether checks passed, when the pull request opened. Those are
compliance facts. An engineer looking for the bottleneck needs cycle time, wait time, queue age, batch
size, rework, and spend, and git holds all of it once you fetch what the remote already advertises.

So the data path is one command a developer runs with the SSH access they already have: mirror-fetch each
registered repository, including tags and `refs/pull/*/head`, then rebuild. No workflow, no token, nothing to
provision. Compliance facts are the second phase's job (`add-change-audit`), and it adds them as an option rather
than as a precondition here.

## The pull head ref is what makes timing honest

A squash rewrites the branch into one commit with the merge time on it. A rebase merge rewrites every
commit's committer date to the moment of merge. Read from the default branch alone, wait time collapses to
zero and cycle time becomes whatever the merger's clock says. The pull head ref keeps the original commits,
with their author dates, after the merge and after the branch is deleted. Reading timing from there is what
lets the same two numbers mean the same thing whichever merge method a team uses, and it is why the registry
fetches those refs rather than treating them as a curiosity.

The same refs answer two questions the earlier design needed a workflow for. A pull head not reachable from
the default branch is unmerged work, with an age, which is the queue. Session files on that ref's tree are
the cost of work that never shipped, which the R&D allocation needs. What the refs cannot say is whether the
pull request is open or closed, and the read says so rather than guessing.

## Association, not observation, classifies the population

Without a platform record, "did this go through a pull request" is answered by association: the number in
a squash or merge subject, or patch identity between the change's commits and a pull head ref. A change
that matches neither is out-of-band. This is weaker than the platform's own mapping and the projection
records which method associated each change so a later reader knows which. It is also enough for an
engineer, because the question here is where work waits, not whether an assessor would accept it.

## Two trust classes, because cost is still self-reported

Git observed the commit graph and its dates. The harness reported what the session spent. Those stay
separate in every record and every read, so a spend figure never borrows the credibility of a merge time.
There is no third class. The earlier design's `observed` platform facts belong to the second phase's
collector, which adds them under the same vocabulary when it is enabled.

## The change is the unit, whichever way it merged

A squash is one commit, a merge commit brings its branch in through the second parent, and a rebase merge
is a run of rewritten commits tied together only by the `Change:` trailer the commit hook writes once per
branch. Trailers are read from the merge message first and the commits second, and a single-valued trailer
that disagrees across commits is a gap rather than a guess. This is unchanged from the earlier draft; it
was the part that never depended on the platform.

## Missing is counted, never zeroed

A change with no session declaration is undeclared. A change naming a session whose file never arrived is
unreported. Both are excluded from every average and shown as a count beside it. The one figure this
ledger exists to produce, spend per unit of work, is the one most easily corrupted by treating a missing
record as free, and the design refuses that in the schema rather than in a footnote.

## Signals, not findings

The earlier auditor turned everything into findings with a lifecycle. An engineer does not acknowledge a
slow week. A signal here is a read that crossed a threshold the registry declares, with the changes behind
it, and it has no state. The second phase, `add-change-audit`, is where a rule produces a finding someone has to
answer for.

## Nothing keyed to a person

The Board reads by change, spec, repository, provider, and model. It never offers a person as a dimension,
and the projection carries no field that would let a consumer add one without the pseudonymous operator
identifier that cost allocation makes opt-in and keeps out of every read here. The audience for this tool
is the engineers being measured; a tool they would refuse to install is not observability.

## Canonical JSON, byte-identical on any machine

Two developers who fetched the same ref tips get the same bytes, and the projection records those tips so a
difference is explainable. There is no shared projection to push: the registry and the configuration are
the only shared state, and both are files in this repository. That keeps the reproducibility claim testable
with two laptops and no service.

## Child git processes get a clean environment

The tests and the projection spawn git against mirrors and fixture repositories. When one of those spawns
happens inside a hook, git has already set `GIT_INDEX_FILE`, `GIT_DIR`, and their relatives for the parent
operation (a partial commit hands its hooks a temporary index), and a child that inherits them writes
into the parent's index. The first dogfooding pull request hit exactly that: a session-file commit failed
with an invalid object because a fixture's README had been staged into the temporary index. The git
wrapper now strips every inherited `GIT_*` location variable, and a test asserts it.

## The contract is what the second phase builds on

`add-change-audit` layers rules over the same projection and adds a governance view to the same Board
without editing the `capture` or `flow` packages. Session schema, trailer vocabulary, registry format, and
projection schema are each versioned so that a change here is a visible break for the audit layer rather
than a silent one, and so an evidence pack can name the versions it was computed under.
