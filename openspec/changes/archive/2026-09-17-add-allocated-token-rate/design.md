# Design: Add Allocated Token Rate

## Input and output lead, cache reads sit beside them

The two candidate denominators differ by more than two orders of magnitude over this repository's own
records: 3,440,144 input and output tokens against 892,856,906 cache reads in September. A rate over the
sum is dominated entirely by the cache term, and moves with how long a context stayed warm rather than with
how much work was asked for — a session resumed cold and a session resumed warm ask for the same work and
would report rates two hundred times apart.

So input plus output is the headline, and the cache rate is a second line rather than a second denominator.
Both are shown, because hiding the cache figure would misrepresent how many tokens actually moved; folding
it in would misrepresent what the work cost.

## The rate divides over the sessions that took a share, not over every session

The amount is allocated only to sessions with agent run seconds
(`openspec/specs/flow-observability/spec.md`, the allocation requirement), so those are the sessions whose
tokens belong in the denominator. A session excluded from the allocation contributed nothing to the amount
and must not dilute the rate.

Within that set a session may still carry `figuresMissing`: it took a share of the amount and reported no
tokens. Dropping it would shrink the denominator silently and make the rate read high with no explanation,
so it is counted and named on the figure. On the current corpus three of six allocated sessions report no
tokens, which is why the rate reads $73.68 per million rather than the $29.07 a hand calculation over every
record with figures would suggest — the difference is the point of the count.

## No tokens means no rate, not a rate of zero

When no session that took a share reported tokens, the figure is null and the page says the rate could not
be computed. A zero would claim the tokens were free, which is the failure this repository already refuses
everywhere else: a missing input is counted and named, never rendered as a measured zero.

## It is allocated, not reported

The rate inherits the trust class of the amount it divides. It is arithmetic over an operator-entered amount
and a set of harness-reported token counts, so it is weaker evidence than either, and carries `allocated`
and the same citations rather than being presented as something the harness said.
