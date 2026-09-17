# Design: Add Subscription And Operator Spend

## Subscription cost is a period record, not a session field

`packages/capture/src/session.ts:132-137` rejects a subscription session whose `costUsd` is not zero, and
that rule is correct: the session incurred no marginal cost, and a session hook cannot know what share of
the month it will turn out to be responsible for, because the rest of the month has not happened yet. Any
design that writes an amount onto the session record either forces the hook to guess a denominator or
forces a later pass to rewrite a record that is already committed and cited.

So the period is the record. A subscription cost record names the plan, the period, the amount, the
currency, and the overage paid beyond the plan, and the projection joins it to the sessions whose
`endedAt` falls in that period. `notionalCostUsd` (`packages/capture/src/session.ts:21`) is left where it
is and still unused by any read; a per-token equivalent for a subscription session answers a different
question than what the plan cost, and this change does not need it.

## The allocation basis is agent run seconds, because tokens are dominated by cache reads

Exactly one record in this repository, the session recorded for the figures work on 2026-09-17, carries
real figures at all: it reports 62,104,495 cached tokens against 181,614 output and 510 input. Weighting an allocation by tokens would
make it, to three significant figures, an allocation by cache reads — a quantity that rises with how long a
session's context stayed warm and falls when a session is resumed cold, neither of which is a claim about
how much of the plan that session consumed. Allocating evenly per session is worse in the other direction:
the recorded sessions run from 1,150 to 2,280 agent seconds, so an even split would charge a short session
and a long one identically.

`agentRunSeconds` is also the better-populated field. Four of the twelve records carry a non-zero
`agentRunSeconds` while only one carries token figures, so a basis of agent seconds produces a usable
figure on strictly more of the existing corpus than a basis of tokens would.

## A session with no agent seconds is excluded and counted, never allocated zero

Eight of the twelve existing records carry `agentRunSeconds: 0`. Those sessions cannot take a share of a
proportional allocation, and giving them one of zero would state that they cost nothing, which is precisely
what `openspec/specs/flow-observability/spec.md:118-127` forbids for every other unknown figure: missing
inputs are excluded with their count stated and are never counted as zero.

So the allocation excludes them and says how many it excluded, exactly as cost per story point already
excludes changes lacking the unit (`openspec/specs/flow-observability/spec.md:203-208`). When every session
in a period carries zero agent seconds, none of that period's amount is allocatable; the period reports its
amount as unallocated rather than spreading it evenly over sessions that recorded no agent time.

## `figuresMissing` withholds reported figures, not allocated ones

Eleven of the twelve records carry `figuresMissing`, and the accepted contract excludes such a record from
every cost and token figure. Read naively that would exclude them from allocation too, leaving a single
record to carry a whole month and defeating the change.

The two are different facts. `figuresMissing` says the harness did not report token and cost figures for
that session; it says nothing about how long the agent ran, and
`s-20260917-board-ui-layout` demonstrates the combination directly, carrying `figuresMissing: true`
alongside `agentRunSeconds: 2280`. An allocated figure is computed from the period amount and the agent
seconds, and needs no reported figure at all. A record therefore takes an allocated share whenever it
carries non-zero agent seconds, whatever its reported figures, and the excluded counts for reported and
allocated figures are stated separately because they exclude different records.

## `allocated` is a trust class, not a new kind of number

`openspec/specs/telemetry-capture/spec.md:12-17` already requires every figure to declare the trust class
it was computed from, and The Board already renders that class beside the figure
(`packages/flow/src/board-html.ts:491`). An allocated amount is weaker evidence than a reported one — it is
an arithmetic consequence of an operator-entered period amount and a basis this repository chose — so it
takes its own class rather than being presented as `reported`. No new presentation mechanism is needed;
the existing one gains a third value.

## An open period's allocation is provisional

The projection stays deterministic in the sense `openspec/specs/flow-observability/spec.md:262` requires:
the same records and the same ref tips produce the same bytes. But a change merged early in a month holds a
larger share of that month than it will hold once the rest of the month's sessions land, so its allocated
cost falls over the period without any record changing. That is a property of proportional allocation, not
a defect, and the honest response is to label it: a figure drawn from a period that has not closed renders
as provisional, and one drawn from a closed period does not.

## Operators are symmetric in what is tracked and asymmetric in unit

The accepted contract admits provider and model as dimensions
(`openspec/specs/flow-observability/spec.md:183-194`) while excluding the human operator, so the agent side
of a change is measurable and the human side is not. This change makes the dimension cover both.

The units stay different on purpose. An agent's consumption of a paid plan is denominated in the currency
the plan is billed in. A human's effort is denominated in hours, from `operatorActiveSeconds` under its
idle cap (`packages/capture/src/session.ts:54-56`), and is never multiplied by a rate — the rejection of
`hourlyRate`, `rate`, `salary`, and `compensation` at `packages/capture/src/session.ts:42` is what keeps
the record incapable of expressing one, and it is not relaxed here. The two figures render beside each
other and are never summed, because a sum would require exactly the rate the schema refuses to hold.

This is also where the privacy property actually lives. Pseudonymity is enforced by `isPseudonymousId`
(`packages/capture/src/config.ts:143`) and by the forbidden-key rejection above, both of which survive this
change untouched. The Board-level prohibition removed here was doing something different from those guards:
it was withholding a measurement, not protecting an identity.

## Human-only changes have hours that no record holds

`openspec/specs/flow-observability/spec.md:139-143` establishes `Session: none` as a declaration that a
change was human-only work rather than a missing record. Such a change has human hours by definition and no
session file to carry them, because `operatorActiveSeconds` is computed by a harness hook from that
harness's own events.

This change does not invent a figure for them. It requires that they be excluded from the human-hours
figure with their count stated, in the same shape as every other exclusion, so a reader sees that the hours
shown cover agent-assisted work only. Recording hours for work done outside the harness would need a
separate entry path and is left to a later change.

## Enabling allocation is forward-only

`telemetry.config.json` carries `costAllocation.enabled: false`, and none of the twelve existing records
carries `operatorId` or `operatorActiveSeconds`. The figure is computed from live harness events
(`packages/capture/src/session.ts:54-56`), so there is nothing to reconstruct from and no backfill is
attempted. The human-operator dimension therefore starts empty and fills from the first session recorded
after the flag is enabled, and its excluded count states how much of the corpus predates it.

## Phase two carries the same prohibition and will have to be reconciled

`openspec/changes/add-change-audit/proposal.md` is an active, `Blocked` change whose Non-Goals forbid
per-person aggregation anywhere, including evidence packs, and forbid a rule from grouping, counting,
ranking, or trending by person across records. That is the same position this change supersedes for the
flow reads, written for the audit package instead.

This change does not edit that proposal, because it is not a dependency in either direction and phase two
has not been implemented. It does change the repository's position underneath it, from "no figure keyed to
an operator" to "no figure keyed to a person, and an operator identifier is not a person." Whoever
implements `add-change-audit` reconciles its Non-Goals with the operator dimension accepted here rather
than re-deriving the older boundary from a proposal written before it.
