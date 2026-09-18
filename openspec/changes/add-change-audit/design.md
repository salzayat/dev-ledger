# Design: Add Change Audit

## Two phases, one repository, one Ledger

Phase one records what git can see and turns it into flow signals. This phase judges those same records
against rules and produces evidence someone outside the team can read. Keeping them as two phases of one
repository is what keeps observability one codebase: an engineer installs `dev-ledger` and gets The Ledger
whether or not any rule set is enabled, and a team that needs evidence sets a governance level and gets the
same Ledger with a governance view. Nobody buys an auditor first, and this shape means nobody has to. The
`capture` and `flow` packages are not edited by this change; anything the audit layer needs from them is a
follow-on change to their capabilities.

## Rules are code, packs are data

The earlier draft made rules operator-authored data with a predicate registry, extension declarations, and
pack-upgrade diffing. That is a product for a later season. A rule here is a versioned function with a
typed aggregation key, which is smaller to build, easier to test, and enforces the one boundary that
matters at the type level: the key type has no member for a person, so a rule that ranks authors cannot be
written. Levels and packs stay data, because mapping a rule to the controls it evidences is the part a team
should be able to edit and a standard's owner should be able to review. A team extends a pack by adding
rule identifiers and exceptions in its configuration, never by editing a shipped seed.

## The git-only baseline is a real audit, and it says what it cannot see

An SSH-only deployment can prove that every change went through a pull request, named an accepted spec,
declared and reported its session, and left no out-of-band or conflicting record. That is change control's
skeleton, and it is what post 3 runs live. What it cannot prove is who reviewed and whether checks passed,
and the honest move is to make `not-observable` a fourth control state rather than to infer a pass from the
absence of a record or to fail a control nobody could evidence. Every pack lists those controls beside the
evidenced ones. An assessor who reads "not observable, collector off" knows what to ask for next; an
assessor who reads "not evidenced" would draw the wrong conclusion.

## The collector is one credential in one place, and it is optional

When a team needs the platform facts, the collector fetches them from this repository's own CI with one
read-only token stored here and nowhere else. Developers stay credential-free, the audited repositories gain
no workflow, and the token's scope is the union of reads the records need. This replaces the earlier
design's per-repository ledger workflow, workflow-owned branch, standing ledger pull request in every
audited repository, and the half-dozen gap types that existed only to police that mechanism. The one thing
kept from it is the discipline: records arrive on this repository's default branch through a pull request
opened with the run's own token, which starts no further runs, and a scheduled re-derivation catches a
hand-edited record as a restatement.

## Findings are recomputed; only decisions are events

A finding is a pure function of a rule version and the records it cites, so storing it would create a
second copy that can disagree with the projection. Its content-addressed identifier is what lets an episode
quote a finding and a reader recompute it. What cannot be recomputed is what a person decided, so
acknowledgements, resolutions, exceptions, and exports are appended to a decision file under version
control, per audited repository, and a finding's state is the fold of those decisions. An in-place edit of
a merged decision line is a restated decision, caught by comparing the file against its own history.

## Evidence is scoped to the release, generated, and hashed

An assessor's scope is what is running. Phase one already computes release membership from tag
ancestry, resolves cherry-picks, and lists unmapped and unreleased changes, so a pack is a walk over that
range rendering Markdown. Determinism is the whole value: no timestamp, hostname, or operator name in hashed
content, and an export record pinning the manifest hash against the release, configuration, rule versions,
and projection hash, so a pack regenerated years later checks against it and the files never need to be
stored.

## Independence is about correlated failure, not headcount

`distinct-session` is gone from the ladder because two sessions of one model share the same blind spots and
the earlier design already said it bought almost nothing. `distinct-model` helps, `distinct-provider` is the
level worth defaulting to, and `distinct-human` is what a team wants on the paths that matter, so the
requirement is scopeable by path with the strictest match governing. Changes to hooks, workflows, agent
instructions, and the telemetry or governance configuration always require a human, because a pull request
that edits the reviewer could weaken the check judging it. All of this evaluates only with the collector on;
without it there are no observed reviews to evaluate.

## Detective is still a control, and the label is the control

Nothing here prevents anything. A free private repository cannot require a review, and even a protected one
can be overridden by an administrator. Each control carries `preventive` or `detective` per period from the
protection status the collector recorded, and `detective` whenever the collector is off. The pack states
that overrides are reported, not prevented.

## Metadata only

Pointing this at a payment or clinical system is the point, and it is also the risk. Records carry
identifiers, paths, commit references, actors, timestamps, and outcomes; a record with an unclassified
free-text payload is rejected at load. Findings and packs cite; they do not quote.

## One Ledger, extended

The earlier plan had a console section, a dashboard, and a board. There is one Ledger, from phase
one, and this phase adds a governance view to it and the productivity rule set's panels
beside its spend panels. The flow views render exactly as phase one rendered them, which phase one's own
tests assert against the extended Ledger. Three surfaces over one
stream were ceremony; one Ledger that grows a view when a team needs evidence is the shape both audiences
can live with.
