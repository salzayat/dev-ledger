# Design: Add DORA Signals

## Approximate to the tag, and say so

DORA's keys are defined against deployments. Git holds releases, not deployments, so every DORA read here
is computed to the release tag and labeled that way in the projection, on The Board, and in the
methodology page. A team that deploys every tag reads the numbers as they stand. A team that does not
sees the approximation named beside the figure, and phase two's collector replaces the tag with the
deployment record without changing the read's shape.

## Failures are the escapes already found

Change failure rate needs a definition of failure that git can see. Phase one already has one: an escape,
a revert or a `fix` change after the newest release that touches files that release changed. The rate is
escapes divided by releases in the measured window, and the denominator is printed with the rate, because
a rate of 0.5 means one thing over two releases and another over forty.

Time to fix reuses the same escapes. Each one is matched to the released change it targets: a revert names
its commit, and a fix shares files with a released change, in which case the most recent such change is
the target. The interval from that change's merge to the fix's merge is the time to fix. Restore in
production would need a deployment record, so the read is called time to fix and not time to restore.

## Trends are weekly buckets over the same window

Merge frequency is one average today. A weekly count of merged changes and a weekly sum of session cost
over the measured window give both throughput and spend a shape, and the same bucketing serves both so a
reader can put the two charts side by side. Buckets are weeks starting on the Monday of the first merge.

## Cost class is a per-session fact with a per-change default

A session file may carry its own `costClass`, and a change may carry a `Cost-Class:` trailer. The session's
value wins for that session's figures; the change's value covers sessions without one; anything else is
`unclassified` and never defaulted, matching the R&D allocation rule already in the capture schema. Spend by
class is the read a preparer or a manager asks for first, and it is the only spend read that a solo
engineer might not, which is why it sits after the DORA strip rather than in it.

## What stays out

No deployment records, no time to restore, no environment, and no person dimension. The Board keeps its
rule that a figure whose inputs cannot be enumerated does not render: each DORA card cites the releases
and changes behind it.
