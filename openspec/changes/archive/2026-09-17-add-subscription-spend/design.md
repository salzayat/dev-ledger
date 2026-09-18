# Design: Add Subscription Spend

## Subscription cost is a period record, not a session field

`packages/capture/src/session.ts` rejects a subscription session whose `costUsd` is not zero, and that rule
is correct: the session incurred no marginal cost, and a session hook cannot know what share of the month it
will turn out to be responsible for, because the rest of the month has not happened yet. Any design that
writes an amount onto the session record either forces the hook to guess a denominator or forces a later
pass to rewrite a record that is already committed and cited.

So the period is the record. A subscription cost record names the plan, the period, the amount, the
currency, and the overage paid beyond the plan. It lives at `.telemetry/subscriptions/<period>/<plan>.json`
because a team can hold two plans in one month, and a session already names its plan in `subscriptionId`:
the projection joins a record to the sessions whose `endedAt` falls in its period and whose
`subscriptionId` equals its `planId`. `notionalCostUsd` stays where it is and unused by any read.

## The allocation basis is agent run seconds, because tokens are dominated by cache reads

The four records with real figures report 463 million cached tokens against 1.7 million input and output.
Weighting an allocation by tokens would make it an allocation by cache reads, a quantity that rises with
how long a session's context stayed warm and says nothing about how much of the plan the session consumed.
Allocating evenly per session is worse in the other direction: the recorded sessions run from 600 to 2,280
agent seconds, so an even split would charge a short session and a long one identically.

## A session with no agent seconds is excluded and counted, never allocated zero

Twelve of the sixteen existing records carry `agentRunSeconds: 0`. Those sessions cannot take a share of a
proportional allocation, and giving them one of zero would state that they cost nothing, which is what the
accepted contract forbids for every other unknown figure. So the allocation excludes them and says how many
it excluded, as cost per story point already excludes changes lacking the unit. When every session in a
period carries zero, none of the amount is allocatable and the period reports its amount as unallocated.
A subscription session whose period has no record is excluded and counted the same way.

## `figuresMissing` withholds reported figures, not allocated ones

`figuresMissing` says the harness did not report token and cost figures for a session; it says nothing about
how long the agent ran. An allocated figure is computed from the period amount and the agent seconds, and
needs no reported figure. A record therefore takes an allocated share whenever it carries non-zero agent
seconds, and the excluded counts for reported and allocated figures are stated separately because they
exclude different records.

## `allocated` is a trust class, not a new kind of number

Every figure already declares the trust class it was computed from, and The Board already renders it beside
the figure. An allocated amount is weaker evidence than a reported one, an arithmetic consequence of an
operator-entered amount and a basis this repository chose, so it takes its own class, names its basis, and
cites the period record. The record itself is `reported` with producer `operator`; only the shares are
`allocated`.

## An open period's allocation is provisional, and the projection stays deterministic

A change merged early in a month holds a larger share of that month than it will hold once the rest of the
month's sessions land, so its allocated cost falls over the period without any record changing. The honest
response is to label it. A period is open when its end has not passed as of the newest commit the mirror
holds, the same clock the queue ages use, so the same ref tips always produce the same bytes and nothing
reads the wall clock.

## Two currencies never sum

Aggregates are keyed by currency. A repository whose plans are billed in two currencies gets two totals, and
The Board renders both rather than adding them.

## Shares sum to the amount

Each share is rounded to a millionth and the rounding remainder lands on the last share, so a period's
shares sum to its amount exactly, which the tests assert.
