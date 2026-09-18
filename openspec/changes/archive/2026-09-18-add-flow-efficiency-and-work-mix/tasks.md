# Tasks: Add Flow Efficiency And Work Mix

## Signals

- [x] 1.1 `packages/flow/src/signals.ts`: `workMix` per weekly bucket by commit type from the change's
      subject, `other` for an unparsed subject, citing changes.
- [x] 1.2 `flowEfficiency`: distribution of active seconds over cycle seconds per change, with exclusions
      `no-timing`, `no-sessions`, `no-active-seconds`; values above one reported and cited.
- [x] 1.3 `iterations`: distributions of sessions per change and commits per change.
- [x] 1.4 `abandonment`: unmerged pull heads older than `abandonedAfterSeconds` (registry, default thirty
      days): count, spend, tokens, records without figures, citing each pull head.
- [x] 1.5 `specLeadTime`: distribution from a spec's first commit to the merge that archives it; exclusions
      `open` and `untimed`.
- [x] 1.6 `spend.perMergedChange`, `spend.perReleasedChange`, `spend.perRelease`, each with its excluded
      count; on a subscription the figure is tokens and the label says so.
- [x] 1.7 `checkCompliance`: recorded share and pass rate over the window.
- [x] 1.8 `packages/flow/src/registry.ts`: `rework.ignore` globs with the default list; `signals.ts` drops
      pairs whose shared files are all ignored and counts them.
- [x] 1.9 `packages/flow/src/projection.ts`: `PROJECTION_SCHEMA_VERSION` 5.
- [x] 1.10 Tests over fixture repositories: work mix by week, flow efficiency with each exclusion, an
      efficiency above one, iterations, abandonment past the threshold, spec lead time from first commit to
      archive merge with `open` excluded, the three cost figures, check compliance, and the rework ignore
      list.

## The Ledger

- [x] 2.1 HTML: work-mix chart on the weekly buckets, flow-efficiency card, iterations panel, abandonment
      line in the queue panel, spec lead time panel, the three cost figures in the spend panel, check
      compliance beside coverage; terminal render: the same as lines.
- [x] 2.2 `docs/methodology.md`: "Work mix", "Flow efficiency", "Iterations", "Older than", "Spec lead
      time", "Cost per change and per release", "Check compliance", and the rework ignore list.
- [x] 2.3 `docs/contract.md`: the new projection fields and registry keys; README key figures.
- [x] 2.4 `plans/roadmap.md`: this row to `Complete`, at archive time — plan freshness refuses a milestone
      marked complete while its change is still active.

## Verification

- [x] 3.1 `npm run check` passes.
- [x] 3.2 End to end: rebuild over this repository and record here the work mix of the newest week, the
      typical flow efficiency, the spec lead time of `add-dora-signals`, and cost per merged change with its
      excluded count.
      **Recorded**, rebuilt over this repository on 2026-09-18: - Newest week 2026-09-14: 29 changes, all `other` — that week is merge commits, which carry no
      conventional type. - Flow efficiency typical 200% over 6 changes; excluded 29 no-timing, 21 no-sessions, 10
      no-active-seconds. Above one is reported as it stands: the agent sessions ran outside the cycle
      window rather than inside it. - Spec lead time typical 806 s (13m) over 8 specs, 10 excluded as `open`. Measured per spec from its
      first commit to the merge that archived it; `add-dora-signals` is among the archived eight. - Cost per merged change: 491,449 tokens over 7 changes, 59 excluded for carrying no session figures,
      and `tokensOnly` because every contributing session is a subscription session with cost fixed at
      zero.
