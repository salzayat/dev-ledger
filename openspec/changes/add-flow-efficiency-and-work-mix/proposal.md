# Add Flow Efficiency And Work Mix

## Why

Phase one measures how long work takes and how long it waits, and the DORA addendum measures how often it
ships and how often it fails. Neither says what the work was, how much of the elapsed time was work, how
many attempts it took, what never shipped, or how long an idea took from its first commit to its release.
Those are the reads the flow frameworks ask for next (flow efficiency and flow distribution), the ones a
product owner asks for first (spec lead time, work mix), and the ones a preparer asks for once the spend
figures are real (cost per merged change, per released change, per release). Rework, meanwhile, is a
count dominated by lockfiles and generated files, so it is read as noise rather than as a signal.

Every input is already in the projection: each change's subject, commits, sessions with active seconds,
merge time, release membership, `Spec:` trailer, and the unmerged pull heads with their ages. Nothing new is
captured.

## What Changes

- Work mix: changes and spend per week by the conventional commit type on the change's subject (`feat`,
  `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, and `other` for anything else), so a reader can see
  whether a week shipped features or paid interest.
- Flow efficiency: per change, agent run seconds plus operator active seconds divided by cycle time, as a
  distribution over changes whose sessions carry both, with the rest excluded by reason.
- Iterations: sessions per change and commits per change as distributions over the measured window.
- Abandonment: unmerged pull heads older than a registered age, their count, and the spend on them, so
  the cost of work that never ships is a total rather than a list.
- Spec lead time: from the first commit citing a `Spec:` to the merge that archives that change, as a
  distribution, with specs that are not yet archived excluded by reason.
- Cost per merged change, per released change, and per release, beside cost per unit of effort.
- Check compliance: the share of changes that recorded a local check outcome, and the pass rate among
  them.
- A rework ignore list per registry entry, so lockfiles and generated files stop dominating the pairs.
- The Board gains a work-mix chart on the weekly buckets, a flow-efficiency card, an iterations panel, an
  abandonment line in the queue panel, a spec lead time panel, the three cost figures, and a check
  compliance line; the terminal render gains the same lines; the methodology page explains each read.
- `PROJECTION_SCHEMA_VERSION` goes to 5.

## Dependencies

- `add-dora-signals`, for the weekly buckets the work mix shares and the coverage counts the check
  compliance read sits beside.
- `fix-transcript-figures-and-board-links`, so the cost figures are computed over records with real
  token counts.

## Non-Goals

- No pickup time, review duration, review rounds, or reviewer load. Those need review events, which git
  does not hold; they stay in phase two's collector.
- No CI pass rate or CI duration. Local check outcomes are what the hooks record.
- No satisfaction or communication measures. The SPACE dimensions that need a survey stay outside a tool
  that refuses a person dimension.
- No product outcome linkage. The projection already carries `spec`, `release`, and cost per change; a
  product tool joins on those.
- No person dimension, no team comparison.
