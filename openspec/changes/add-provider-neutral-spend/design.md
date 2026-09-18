# Design: Add Provider Neutral Spend

## The metered rate is the stronger figure, and it is the one that was missing

`add-allocated-token-rate` divides an amount that was apportioned by agent run seconds, so the rate inherits
the apportioning's assumptions and carries trust class `allocated`. A metered session reports its own cost:
dividing it by its own tokens involves no assumption at all and is `reported`.

Both are shown rather than one replacing the other, because a team running a subscription alongside a
metered provider has two genuinely different kinds of spend and collapsing them would hide which is which.
They are never summed into a single rate: one is a measured quantity and the other is a consequence of an
allocation basis this repository chose.

## Currency belongs in a field, not in a field name

`costUsd` was defensible while every record came from one plan in one currency. The allocation already
carries currency per period and renders `money(amount, currency)`, so the projection is multi-currency and
the reported figure is the only part that is not.

The existing field stays readable, because nineteen committed records carry it and this repository does not
rewrite records to fit a later schema. A record carrying `costUsd` is read as a cost in USD; a record
carrying the currency-named figure is read in the currency it names. No committed record changes, and no
read has to guess.

## Cached tokens are two measurements wearing one name

`openspec/specs/telemetry-capture/spec.md:249` defines cached tokens as cache reads plus cache writes, which
is the shape of one provider's usage object — `sumTranscriptUsage` reads `cache_read_input_tokens` and
`cache_creation_input_tokens` (`packages/capture/src/figures.ts`). A provider that reports only a cache hit
count has no write figure, so summing its one number into the same field records it as having written
nothing, which is a claim rather than a reading.

This matters now because the repository publishes a cache rate. Over its own records cache reads run
892,856,906 against 3,440,144 input and output, so the cache figure dominates anything it enters; a
cross-provider cache rate over two different definitions of "cached" would be a number with no meaning.
Splitting reads from writes lets each provider's figure say what it covers, and the read states which
components it included, the same way every other figure states its trust classes.

Existing records keep one `cachedTokens` and are read as a combined figure whose components are unknown,
which is the honest reading of what they recorded.

## Nothing here is keyed to a provider

The change adds no branch on a provider identifier. Every difference it handles is a difference in what a
record reports — a currency, a present or absent write count, a metered or subscription billing kind — and
every one of those is already a field. That is the property that made multi-provider work at all, and it is
kept deliberately: a provider this repository has never seen should flow through unchanged.

## Sequencing against the allocated rate

The allocated token rate is drafted in an open pull request rather than on the default branch, so it is not
nameable as a dependency until it lands and is recorded here instead. The two rates share a denominator rule
— input plus output leads, cache reads sit beside it — and render in the same place, so implementing this
one first would mean writing that rule twice and reconciling the renderings afterwards. This change is
selected after that one lands, and whichever archives second is rebased onto the first.
