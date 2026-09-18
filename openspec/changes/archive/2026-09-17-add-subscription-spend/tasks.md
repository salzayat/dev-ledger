# Tasks: Add Subscription Spend

## 1. Subscription cost records

- [x] 1.1 `packages/capture/src/subscription.ts`: the record type (`schemaVersion`, `planId`, `period`,
      `amount`, `currency`, `overageAmount`), its path `.telemetry/subscriptions/<period>/<plan>.json`,
      validation (non-negative amounts, `YYYY-MM`, three-letter currency, the session record's forbidden
      keys), and the builder.
- [x] 1.2 `packages/capture/src/cli.ts`: `telemetry subscription record --plan --period --amount --currency
[--overage] [--no-commit]`, and `telemetry validate` covering both record directories;
      `scripts/telemetry.sh` routes `subscription` to the capture command line.
- [x] 1.3 `.githooks/pre-push` refuses to push an uncommitted subscription record as it does a session file.

## 2. Allocation in the projection

- [x] 2.1 `packages/flow/src/subscriptions.ts`: read the records from the default branch's tree, producer
      `operator`, trust `reported`, invalid records counted.
- [x] 2.2 `packages/flow/src/signals.ts`: join each record to the sessions ending in its period on its plan;
      apportion amount and overage by `agentRunSeconds` with shares summing exactly; exclude and count
      sessions with no agent seconds and sessions with no period record; report a period with no eligible
      session as unallocated; mark a period open as of the newest commit as provisional; aggregate by
      currency into total, by change, by spec, by provider, by model, and per unmerged pull request, every
      figure carrying trust `allocated`, the basis, and its cites.
- [x] 2.3 `packages/flow/src/projection.ts`: `subscriptions` per repository; `PROJECTION_SCHEMA_VERSION` 5.

## 3. The Board

- [x] 3.1 HTML: an `allocated` stat in the summary strip, a subscription spend panel listing each period
      with its status and cites, an allocated column on the spec, provider, and model tables, and the
      allocated share beside the reported spend in the queue and changes tables, each marked provisional
      when its period is open; the `allocated` badge in both color schemes.
- [x] 3.2 Terminal render: the periods, the totals per currency, allocation by spec, and the excluded line.

## 4. Documentation

- [x] 4.1 `docs/contract.md`: the subscription cost record (schema version 1), the `allocated` trust class,
      the new projection fields.
- [x] 4.2 `docs/methodology.md`: "Subscription cost is a period record" and the provisional rule.
- [x] 4.3 `README.md`: the record, the command, and what The Board shows; `plans/roadmap.md`: this row and
      `add-operator-dimension`.

## 5. Verification

- [x] 5.1 Tests: shares proportional to agent seconds and summing to the amount with overage apart; a
      zero-second session excluded and counted, never zero; a period with no eligible session unallocated;
      a `figuresMissing` record taking its share while still excluded from reported figures; an open period
      provisional and a closed one not; a session with no period record excluded; an invalid record
      counted; two rebuilds byte-identical; a forbidden key rejected on a record; the command writing and
      committing a record; the page rendering the panel, the badge, and the provisional mark with no script
      and no loaded resource.
- [x] 5.2 `npm run check` passes, and `board --html` end to end over this repository renders the panel
      reading "no period record" until an operator records one. Evidence (2026-09-18): rebuild sha256
      `38a572e965d9df32797aa06b10a7e6424c7640f70f1e753d8968d1762c8ee12d`; the terminal render reported
      "subscription spend (allocated by agentRunSeconds): no period record" with 17 sessions excluded for
      lacking one; the page carried the panel and the `allocated` badge and no script or loaded resource.
