# Tasks: Remove Zero Figures

- [x] 1.1 ~2 `signals.ts`: weekly buckets carry the allocated share.
- [x] 1.2 ~3 `ledger-html.ts`: reported cost as "none reported" on subscriptions everywhere it rendered
      `$0.00`; spend over time leads with allocated when nothing is reported; confirmed hours, escapes, the
      queue, exclusion lines, and effort units read as absence; per-unit money keeps four places under a
      cent.
- [x] 2.1 ~1 Methodology and roadmap.
- [x] 3.1 ~2 Test: a subscription-only repository renders no `$0.00` and the chart leads with allocated.
- [x] 3.2 ~1 `npm run check`; a rebuild over this repository recorded in the pull request. Evidence
      (2026-09-19): sha256 `0c6efac0…`; the rendered page carries 13 "none reported" cells, the spend chart
      reads "allocated across 1 week", and the one remaining `$0.00` is the September note's old text,
      which this change rewrites.
