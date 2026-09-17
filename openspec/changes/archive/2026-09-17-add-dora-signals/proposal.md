# Add DORA Signals

## Why

Phase one gives an engineer wait time, cycle time, the queue, batch size, merge frequency, rework, and
escapes, and it records what an agent session spent. It does not say the four numbers most teams already
report on, the DORA keys, and it does not turn the spend it records into the figures an engineer or a
manager would compare: cost per change, spend over time, and research against production.

The projection already holds the inputs. `computeSignals` (`packages/flow/src/signals.ts`) sees every
change's first and last commit dates, its merge time, its release membership, its files, and its session
records with cost and cost class. `computeReleases` (`packages/flow/src/releases.ts`) knows every release
tag, its commit, and the changes it contains. `escapes` already identifies reverts and fixes after the
newest release. Nothing new is collected; the reads are missing.

## What Changes

- Four DORA reads, each labeled with what git can approximate and what it cannot see:
  - deployment frequency as releases per week from release tags;
  - lead time for changes as first commit to the release tag that carried the change, with the merge-to-tag
    interval reported separately;
  - change failure rate as escapes per release, with the denominator stated;
  - time to restore approximated as time to fix: from the merge of the released change an escape targets to
    the merge of the escape, with the target resolved by revert reference or shared files.
- Trends: changes merged and cost per week over the measured window, so throughput and spend have a
  shape rather than one average.
- Spend by cost class (`rd`, `production`, `unclassified`) from each session's cost class or the change's
  `Cost-Class:` trailer, and the share of changes with an agent session, human-only, and undeclared.
- The Board gains a DORA strip (four cards with their approximation notes), a spend-over-time column
  chart, and a cost-class panel; the terminal render gains the same lines; the methodology page explains
  each approximation.
- `PROJECTION_SCHEMA_VERSION` goes to 4 for the new fields.

## Dependencies

None.

## Non-Goals

- No deployment records. Deployment frequency and lead time stop at the release tag; observing an
  environment is phase two's collector.
- No time to restore in production. Time to fix ends at the fix's merge.
- No person dimension, no team comparison.
- No new capture. Sessions without figures stay excluded and counted, exactly as today.
