# Tasks: Add Allocated Token Rate

## 1. The figure

- [x] 1.1 Accumulate, per currency in `packages/flow/src/signals.ts`, the allocated amount and the input,
      output, and cached tokens of the sessions that took a share.
- [x] 1.2 Count sessions that took a share and reported no tokens.
- [x] 1.3 Divide once the sums are final, yielding null rather than zero when a denominator is zero.
- [x] 1.4 Carry the provisional mark from the shares behind the rate.

## 2. The Board

- [x] 2.1 Render the input-and-output rate as the headline and the cache-read rate beside it, with the
      allocated amount, the token totals, and the count of sessions reporting none.
- [x] 2.2 Say on the page that a subscription has no token component, so the figure is not read as a price.
- [x] 2.3 Match it in the terminal render.

## 3. Documentation

- [x] 3.1 Document the rate and its denominator choice in `docs/methodology.md`.

## 4. Verification

- [x] 4.1 Test that the rate divides the allocated amount by input plus output, and that cache reads do not
      enter that denominator.
- [x] 4.2 Test that a session taking a share while reporting no tokens is counted and does not silently
      shrink the denominator.
- [x] 4.3 Test that a rate with no tokens behind it is null rather than zero.
- [ ] 4.4 Run `npm run check` and the board end to end, recording the result in the pull request.
