# Tasks: Add Flow Efficiency And Work Mix

## Signals

- [ ] 1.1 `packages/flow/src/signals.ts`: `workMix` per weekly bucket by commit type from the change's
      subject, `other` for an unparsed subject, citing changes.
- [ ] 1.2 `flowEfficiency`: distribution of active seconds over cycle seconds per change, with exclusions
      `no-timing`, `no-sessions`, `no-active-seconds`; values above one reported and cited.
- [ ] 1.3 `iterations`: distributions of sessions per change and commits per change.
- [ ] 1.4 `abandonment`: unmerged pull heads older than `abandonedAfterSeconds` (registry, default thirty
      days): count, spend, tokens, records without figures, citing each pull head.
- [ ] 1.5 `specLeadTime`: distribution from a spec's first commit to the merge that archives it; exclusions
      `open` and `untimed`.
- [ ] 1.6 `spend.perMergedChange`, `spend.perReleasedChange`, `spend.perRelease`, each with its excluded
      count; on a subscription the figure is tokens and the label says so.
- [ ] 1.7 `checkCompliance`: recorded share and pass rate over the window.
- [ ] 1.8 `packages/flow/src/registry.ts`: `rework.ignore` globs with the default list; `signals.ts` drops
      pairs whose shared files are all ignored and counts them.
- [ ] 1.9 `packages/flow/src/projection.ts`: `PROJECTION_SCHEMA_VERSION` 5.
- [ ] 1.10 Tests over fixture repositories: work mix by week, flow efficiency with each exclusion, an
      efficiency above one, iterations, abandonment past the threshold, spec lead time from first commit to
      archive merge with `open` excluded, the three cost figures, check compliance, and the rework ignore
      list.

## The Ledger

- [ ] 2.1 HTML: work-mix chart on the weekly buckets, flow-efficiency card, iterations panel, abandonment
      line in the queue panel, spec lead time panel, the three cost figures in the spend panel, check
      compliance beside coverage; terminal render: the same as lines.
- [ ] 2.2 `docs/methodology.md`: "Work mix", "Flow efficiency", "Iterations", "Older than", "Spec lead
      time", "Cost per change and per release", "Check compliance", and the rework ignore list.
- [ ] 2.3 `docs/contract.md`: the new projection fields and registry keys; README key figures.
- [ ] 2.4 `plans/roadmap.md`: this row to `Complete`.

## Verification

- [ ] 3.1 `npm run check` passes.
- [ ] 3.2 End to end: rebuild over this repository and record here the work mix of the newest week, the
      typical flow efficiency, the spec lead time of `add-dora-signals`, and cost per merged change with its
      excluded count.
