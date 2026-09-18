# Tasks: Add Provider Neutral Spend

## 1. Currency on the reported cost

- [x] 1.1 Add a currency-named reported cost to the session record schema, keeping `costUsd` readable so
      every committed record stays valid.
- [x] 1.2 Read a record carrying `costUsd` as a cost in USD, and one carrying the new figure in the currency
      it names; reject a record carrying both with different values.
- [x] 1.3 Aggregate reported spend per currency, as the allocation already does.

## 2. Cached tokens split

- [x] 2.1 Record cache reads and cache writes as separate figures, keeping `cachedTokens` readable.
- [x] 2.2 Read an existing record's `cachedTokens` as a combined figure whose components are unknown, and
      say so on any figure that includes it.
- [x] 2.3 State on every cache figure which components it covers.

## 3. The metered rate

- [x] 3.1 Compute reported cost divided by input plus output tokens for metered sessions, per provider and
      per currency, with trust class `reported`.
- [x] 3.2 Count metered sessions reporting no tokens, as the allocated rate already counts its own.
- [x] 3.3 Render it beside the allocated rate, never summed with it, and never with a denominator combined
      across providers.
- [x] 3.4 Match it in the terminal render.

## 4. Documentation

- [x] 4.1 Document the currency field, the cache split, and the two rates in `docs/contract.md` and
      `docs/methodology.md`.

## 5. Verification

- [x] 5.1 Test that a record carrying `costUsd` and one carrying the currency-named figure are both read,
      and that a record carrying both inconsistently is rejected.
- [x] 5.2 Test that a provider reporting only cache reads is not recorded as having written zero.
- [x] 5.3 Test that the metered rate divides reported cost by input plus output, carries `reported`, and is
      never summed with the allocated rate.
- [x] 5.4 Test that two providers' rates are reported separately and share no denominator.
- [x] 5.5 Test that no source file outside a data field branches on a provider identifier.
- [x] 5.6 Run `npm run check` and the board end to end, recording the result in the pull request.
