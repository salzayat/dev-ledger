# flow-observability Specification Delta

## MODIFIED Requirements

### Requirement: Flow signals per repository and in aggregate

The projection SHALL provide reads for cycle time and wait time distributions, the unmerged queue (count
and age), batch size (files, lines, and commits per change), merge frequency per day, rework (a change
touching files a change within the configured window also touched, excluding files matched by the registry
entry's ignore list and stating how many pairs the list removed), escapes (a revert, or a change carrying
`fix` in its subject that touches files of a change in the most recent release, after that release's tag),
local check outcomes per change, and spend (tokens and cost) per change, per unmerged pull request, per
spec reference, per provider, and per model, computed separately for each enabled effort unit where a unit
applies. It SHALL also provide the four DORA reads approximated to the release tag, each carrying a note
naming the approximation: deployment frequency as releases per week over the measured window, citing the
tags; lead time for changes as the interval from a change's first commit to the release tag that carried it,
with the merge-to-tag interval reported separately and unreleased changes excluded by reason; change
failure rate as escapes divided by releases in the window, with the denominator stated; and time to fix as
the interval from the merge of the released change an escape targets, resolved by shared files, to the
merge of the escape. It SHALL provide weekly trends of changes merged and session cost over the measured
window, spend by cost class (`rd`, `production`, `unclassified`, taken from the session's cost class, then
the change's `Cost-Class:` trailer, never defaulted), and coverage counts of changes with an agent session,
human-only, undeclared, and unreported. It SHALL further provide: work mix, the changes and spend per weekly
bucket by the conventional commit type of the change's subject, taking for a change merged by a merge
commit the most common type among its branch commits with a telemetry record commit not voting, and `other`
only when no subject carries a type; flow efficiency, the distribution over changes of active seconds (the sum of the change's sessions'
agent run and operator active seconds) divided by cycle seconds, excluding by reason changes with no timing,
no sessions, or no active seconds, and reporting a value above one as it stands; iterations, distributions
of sessions per change and commits per change; abandonment, the count and spend of unmerged pull heads
older than the registered age, labeled as older than that age rather than as closed; spec lead time, the
distribution from the earliest commit carrying a `Spec:` reference to the merge that archives that change,
excluding specs not yet archived as `open` and specs without pull head timing as `untimed`; cost per merged
change, per released change, and per release, each stating the changes excluded for missing figures and
reading as tokens where cost is fixed at zero; and check compliance, the share of changes with a recorded
local check outcome and the pass rate among them. Each read SHALL be available per repository and across the
registry, SHALL state the trust classes it included and the number of changes excluded for lacking what it
needs, and SHALL raise a signal when a registered threshold is exceeded, naming the threshold and the
changes behind it. Spend per unmerged pull request SHALL cite every session record of that pull request,
including the records excluded from its figures. No read SHALL be keyed to a person, and the projection
SHALL NOT offer a person as a dimension.

#### Scenario: A wait-time threshold raises a signal

- GIVEN a registry entry with a wait-time threshold of two days and a period in which three changes waited
  longer
- WHEN the flow reads are computed
- THEN a signal MUST name the threshold and cite the three changes

#### Scenario: Cost per unit of effort excludes what it cannot measure

- GIVEN five changes of which two recorded story points
- WHEN cost per story point is requested
- THEN the result MUST be computed over those two only
- AND it MUST report that three changes were excluded for lacking the unit

#### Scenario: Cost is attributable per provider

- GIVEN changes carrying session records from two different coding-agent providers
- WHEN cost per provider is requested
- THEN each provider's tokens and cost MUST be reported separately
- AND their sum MUST equal the total reported cost

#### Scenario: Spend is attributable to one unmerged pull request

- GIVEN an unmerged pull request with two session records, one carrying figures and one carrying
  `figuresMissing`
- WHEN spend per unmerged pull request is requested
- THEN that pull request's figures MUST be computed from the first record only
- AND it MUST report one record excluded for missing figures
- AND it MUST cite both records

#### Scenario: No signal is keyed to a person

- GIVEN a projection whose session records carry operator identifiers
- WHEN any flow read is listed
- THEN none MUST group, rank, or trend a figure by operator identifier

#### Scenario: Deployment frequency counts release tags and says so

- GIVEN two release tags fourteen days apart
- WHEN the DORA reads are computed
- THEN deployment frequency MUST report one release per week citing both tags
- AND its note MUST state that releases stand in for deployments

#### Scenario: Lead time runs to the tag and excludes unreleased work

- GIVEN a change merged and carried by a later release tag, and a change merged after the newest tag
- WHEN lead time to release is computed
- THEN the first change's value MUST be the interval from its first commit to that tag
- AND the second change MUST be excluded with the reason `unreleased`

#### Scenario: Change failure rate states its denominator

- GIVEN two releases and one escape after the newest
- WHEN change failure rate is computed
- THEN it MUST report 0.5 escapes per release over 2 releases citing the escape

#### Scenario: Time to fix runs from the targeted change's merge

- GIVEN a released change and a later `fix` change touching one of its files
- WHEN time to fix is computed
- THEN its value MUST be the interval between the two merges
- AND it MUST cite the fix and the change it targets

#### Scenario: Spend by cost class is never defaulted

- GIVEN a change carrying `Cost-Class: production` with two sessions, one carrying its own class `rd`, and a
  change with no class anywhere
- WHEN spend by cost class is computed
- THEN the `rd` session's figures MUST be under `rd`, the other under `production`, and the unclassed change
  under `unclassified`

#### Scenario: Work mix reads the subject and never guesses

- GIVEN a week with two `feat` changes, one `fix` change, and one change whose subject has no type prefix
- WHEN the work mix is computed
- THEN that week MUST report two `feat`, one `fix`, and one `other`, each citing its changes

#### Scenario: A merge commit takes its type from what it merged

- GIVEN a change merged by a merge commit whose branch carries two `feat` commits, one `fix` commit, and a
  telemetry record commit
- WHEN the work mix is computed
- THEN that change MUST read `feat`
- AND a merge commit whose branch commits carry no type MUST read `other`

#### Scenario: Flow efficiency excludes what it cannot divide

- GIVEN a change with timing and a session carrying 600 active seconds over a 3,000 second cycle, a change
  with timing and no session, and an out-of-band change
- WHEN flow efficiency is computed
- THEN the first MUST read 0.2
- AND the second MUST be excluded as `no-sessions` and the third as `no-timing`

#### Scenario: Older than the registered age is a total, not a verdict

- GIVEN a registry entry with an abandonment age of thirty days and three unmerged pull heads of which two
  are older
- WHEN abandonment is computed
- THEN it MUST report two pull heads with their combined spend, citing both
- AND its label MUST say older than thirty days rather than closed or abandoned

#### Scenario: Spec lead time ends at the archive merge

- GIVEN commits carrying `Spec: add-x` on two pull requests and a later merge adding
  `openspec/changes/archive/<date>-add-x`
- WHEN spec lead time is computed
- THEN `add-x` MUST read as the interval from the earliest of those commits to that merge
- AND a spec with no archive merge MUST be excluded as `open`

#### Scenario: Cost per merged change states its exclusions

- GIVEN four merged changes of which three carry figures
- WHEN cost per merged change is computed
- THEN it MUST divide the measured spend by three
- AND it MUST report one change excluded for missing figures

#### Scenario: A lockfile does not make a rework pair

- GIVEN two changes within the rework window sharing only `package-lock.json`
- WHEN rework is computed
- THEN they MUST NOT form a pair
- AND the read MUST report one pair removed by the ignore list
