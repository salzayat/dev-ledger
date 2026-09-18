# Design: Add Subscription Declarations

## A declaration is an intention; a record is what happened

The temptation is to delete the period record and let the projection compute every month from the
declarations. That would remove all the clerical work and it is the wrong trade. A declaration says what a
plan is arranged to cost; only a person knows what actually came off the card, and months differ — a
credit, a proration, an overage, a seat added on the nineteenth.

A projection that generated figures from declarations alone would assert twelve months of spend nobody
checked, which is the failure this repository has already met once: the `Session: none` default
(`openspec/changes/fix-session-none-default/proposal.md`) turned an unset variable into a positive claim
about who did the work. The same shape is being avoided here.

So `subscription close` writes a proposal and stops. The commit is the moment a person confirms it, and the
record on the branch remains the only thing any read trusts.

## Effective-dated intervals, because a rate change is a fact with a date

A plan's cost is not a single number; it is a number that held over a span. Holding it as one number per
period file makes a rate change indistinguishable from a typo, and makes "what did this plan cost in March"
a question answered by opening March.

Intervals invert that: `[{from: "2026-01", unit: 100, seats: 5}, {from: "2026-07", unit: 120, seats: 6}]`
says what held and when it changed, in one place, appended to rather than edited. The period a record covers
resolves to exactly one interval, and a period no interval covers is a gap the Board names rather than a
silently missing file.

Seats times unit is kept as arithmetic rather than collapsed to a total because the two move independently
and for different reasons. A total of 720 says nothing; six seats at 120 says a seat was added and the price
rose, and a reviewer can check it against an invoice.

## The Board reports configuration; it does not manage it

The request behind this change was for the dashboard to manage these configurations. It cannot, and the
reasons are the requirements that define it:

- `The Board ... SHALL read only from the projection` (`openspec/specs/flow-observability/spec.md:410`).
- The page contains `no script element` and loads `no external resource`
  (`openspec/specs/flow-observability/spec.md:413`), and must open from a `file:` URL.
- The whole mechanism `SHALL operate using git working copies and mirrors alone and SHALL NOT require any
workflow, hosted service, message broker, database server, or platform API`
  (`openspec/specs/flow-observability/spec.md:524`).

The published board is a static file on a hosting surface with no server behind it; there is nothing for a
form to submit to, and adding one would reverse all three requirements and turn a read surface into an
authority over the records it reads.

What the Board can do is most of what "manage" means in practice: know what is wrong and say exactly how to
fix it. A configuration panel that names every declared plan with no record for a closed period, every
record no declaration covers, every session naming a plan that does not exist, and the uncovered periods,
each beside the command that closes it, turns a silent `noPeriodRecord` exclusion into a worklist. That is a
read over the projection, and it changes nothing about what the page is.

A surface that genuinely edits configuration would be a local program — a command, or a local-only server
that is not the published page — and it belongs in its own change, where the authority it needs can be
argued on its own terms rather than smuggled into a dashboard.

## Open question: binding a session to a plan when a team shares agents

A session says which plan it was billed to through `subscriptionId`, and the harness sets it. For one
operator on one plan that is reliable. For a team where one engineer is on one plan and another on a
different one, that field is load-bearing and nothing checks it: a wrong value moves a session's share to
the wrong plan, and the only symptom is a `noPeriodRecord` exclusion if the value matches nothing at all.

This change names the mismatch on the Board rather than solving it, because the fix is a choice between
options with real costs — deriving the plan from the operator identifier, declaring which operators a plan
covers, or validating `subscriptionId` against the declarations at capture time and refusing a session that
names an unknown plan. That decision wants its own change and its own argument.
