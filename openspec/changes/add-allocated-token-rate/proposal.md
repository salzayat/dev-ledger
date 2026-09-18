# Add Allocated Token Rate

## Why

The Board reports what a subscription period cost and how many tokens the sessions in it reported, and never
relates the two. The question those two figures raise — what did the plan work out to per token — is the one
a reader asks first and the projection cannot currently answer.

It is worth being exact about what such a figure is not. A subscription has no token component: the plan
costs what it costs, so there is no fraction of the amount attributable to tokens and none is being found
here. Nor is it a price: deriving cost from a price table is forbidden by
`openspec/specs/telemetry-capture/spec.md:249`, and this derives nothing from one. It is a division of two
figures the projection already holds, and it belongs to the allocation that produced the amount.

The denominator is the whole design problem. Over this repository's September records, input and output come
to 3,440,144 tokens while cache reads come to 892,856,906 — so a rate computed over everything reads about
260 times better than one computed over the tokens the work asked for. A single unlabelled "cost per million
tokens" would be close to meaningless.

## What Changes

- Compute, per currency, the allocated amount divided by the input and output tokens of the sessions that
  took a share, as the headline rate.
- Report the cache-read rate beside it rather than folding cache reads into the denominator.
- Count sessions that took a share but reported no tokens, so a rate computed over fewer records than it
  covers says so instead of reading low.
- Mark the rate provisional whenever any share behind it came from a period that has not closed, as the
  shares themselves already are.
- Render it on The Board and in the terminal render, carrying the `allocated` trust class and citing the
  records behind it.

## Dependencies

None. `add-subscription-spend` (archived) supplies the allocation this divides, and no active change is
required first.

## Non-Goals

- No price table, and no notional cost. `notionalCostUsd` stays unwritten and unread; a figure for what
  tokens would have cost at list prices is exactly the thing
  `openspec/specs/telemetry-capture/spec.md:249` forbids deriving.
- No claim that a subscription decomposes into a token component. The rate is what the amount worked out
  to, and the page says so where it renders.
- No rate keyed to an operator, and no conversion of a human operator's hours into money.
- No change to how the amount is allocated; the basis stays agent run seconds.
