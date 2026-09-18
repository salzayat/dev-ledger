# change-audit Specification

The change auditor evaluates named rule sets over the records the `flow` package produces for
one or more repositories, and over the platform records the optional collector adds, and produces findings and evidence
for named controls. It never claims compliance, never aggregates by person, and never carries the data of
the systems it audits. Its baseline needs nothing but the git access phase one already uses; every
control that needs the platform says so when the collector is off.

## ADDED Requirements

### Requirement: Rules are versioned code; levels and packs are data

A rule SHALL be a versioned function in this repository with an identifier, the record types it consumes, a
severity from the closed vocabulary `info`, `warning`, `violation`, the controls it evidences, an
aggregation key from the closed type `model`, `provider`, `spec`, `repository`, `window`, `ruleSet`, and a
flag naming whether it needs collector records. Base levels and standard packs SHALL be JSON files under
`seeds/` that map rule identifiers to control labels. A level or pack naming an unknown rule identifier
SHALL be rejected at load. The aggregation key type SHALL have no member for a person, so a rule keyed to a
human author cannot be written.

#### Scenario: A pack naming an unknown rule is rejected

- GIVEN a pack file naming rule `no-such-rule`
- WHEN seeds are loaded
- THEN loading MUST fail and name the pack and the identifier

#### Scenario: A rule declares whether it needs the collector

- GIVEN the rule requiring a distinct reviewer
- WHEN its definition is read
- THEN it MUST declare that it needs collector records

### Requirement: Governance levels with stackable standard packs

The system SHALL express a repository's governance configuration as one base level plus zero or more
standard packs. Base levels SHALL be a closed, ordered vocabulary: `off` (no rules run), `hygiene` (the
repository's own check outcome and the paper-trail gaps), `change-control` (a pull request, an accepted
spec, a reported session, and, with the collector, a reviewer and green checks per change), and `regulated`
(change-control plus retained evidence, deployment linkage, and periodic review). Standard packs SHALL be
additive rule sets carrying a standard reference (initially `pci-dss` and `hipaa`) that can be enabled
independently on top of `change-control` or higher. Enabling a pack SHALL NOT disable a base rule, and the
effective rule set SHALL be the union of the base level and the enabled packs, computed and displayable
before any run.

#### Scenario: A pack requires a sufficient base level

- GIVEN a repository configured at base level `hygiene`
- WHEN an operator enables the `pci-dss` pack
- THEN the system MUST reject the configuration and name the required base level

#### Scenario: Two packs stack without duplication

- GIVEN a repository at base level `change-control` with `pci-dss` and `hipaa` both enabled
- WHEN the effective rule set is computed
- THEN a rule shared by both packs MUST appear once
- AND it MUST list every control it evidences across both standards

#### Scenario: Lowering the level names what stops running

- GIVEN a configuration at `regulated` with one pack enabled
- WHEN an operator lowers the base level to `change-control`
- THEN the system MUST report which rules stop running
- AND the change MUST be recorded with the acting operator and a reason

### Requirement: Extension by configuration, suppression by exception

A team SHALL be able to add rule identifiers to a pack, tighten a rule's severity, and author a new pack
file, without editing the shipped seed files. A shipped rule SHALL NOT be removed from a pack; it MAY be
suppressed only by an exception carrying the acting operator, a reason, and an expiry date. A suppressed
rule SHALL appear in every run's report and every evidence pack as suppressed with its reason and expiry,
and an expired exception SHALL restore the rule and be reported as expired.

#### Scenario: Suppression requires an exception, not a deletion

- GIVEN a shipped rule a team cannot satisfy yet
- WHEN the team attempts to remove it from the pack
- THEN the system MUST reject the removal
- AND it MUST offer an exception requiring an operator, a reason, and an expiry date

#### Scenario: A suppressed rule is still reported

- GIVEN a rule suppressed by an unexpired exception
- WHEN a run completes
- THEN the report MUST list the rule as suppressed with its reason and expiry

#### Scenario: An expired exception restores the rule

- GIVEN an exception whose expiry date has passed
- WHEN the next run executes
- THEN the rule MUST run normally
- AND the run MUST report that the exception expired

### Requirement: Audit run over the registry

An audit run SHALL apply the effective rule set to one or more repositories from the registry
over a stated scope, which SHALL be either a time window or a release range, and SHALL record the
repositories, the scope, the flow projection hash and schema versions, the collector state per
repository, the effective configuration, and the active exceptions. A run producing an evidence pack SHALL
be release-scoped. Findings SHALL cite the rule and the specific records that triggered them. A run SHALL
report findings per repository and in aggregate, naming every repository it covered and every one
the flow projection recorded as unreachable.

#### Scenario: A run cites its evidence

- GIVEN a run of the `change-control` level over one week of records
- WHEN a rule fires on a change that merged with no spec reference
- THEN the finding MUST cite that rule and that change record

#### Scenario: A run records the configuration and projection it ran under

- GIVEN a repository at base level `regulated` with the `hipaa` pack, one active exception, and the
  collector off
- WHEN a run completes
- THEN the run record MUST name the level, the pack, the exception, the projection hash, and that the
  collector was off

#### Scenario: An aggregate names what it could not read

- GIVEN a run over four repositories of which the flow projection recorded one as unreachable
- WHEN the run completes
- THEN the aggregate MUST name the three it covered and the one it could not

### Requirement: Findings are derived and content-addressed

A finding SHALL NOT be stored as a primary record. It SHALL be recomputed from its rule definition and the
records it cites, and its identifier SHALL be the content hash of the rule identifier, the rule version, and
the sorted identifiers of the cited records. The same rule over the same records SHALL produce the same
identifier on any machine, and a change to a rule's version SHALL produce a different identifier rather than
restating the earlier finding.

#### Scenario: The same finding recomputes to the same identifier

- GIVEN two machines holding the same projection and running the same rule set
- WHEN each recomputes findings
- THEN a finding over the same cited records MUST carry the same identifier in both

#### Scenario: A changed rule version yields a new finding identity

- GIVEN a finding produced by a rule and a subsequent version of that rule
- WHEN findings are recomputed
- THEN the resulting finding MUST carry a different identifier
- AND the earlier identifier MUST remain resolvable to the version that produced it

### Requirement: Operator decisions are append-only events

Every decision a person makes about a finding SHALL be recorded as an appended line in a version-controlled,
period-partitioned decision file in this repository under `decisions/<repository>/`, added through a pull
request: acknowledgement, resolution, exception, and evidence pack export, each carrying the acting
operator, a timestamp, and the finding identifier or rule it concerns; a resolution SHALL require a reason
and an exception SHALL require a reason and an expiry. A decision SHALL NOT be edited or deleted; a decision
made in error SHALL be superseded by a further appended line referencing it. A finding's state (`open`,
`acknowledged`, `resolved`) SHALL be the fold of its decisions over the recomputed finding. The projection
SHALL compare each decision file against its own history and SHALL report any commit that modified or
removed an existing line as a restated decision.

#### Scenario: Resolving without a reason is rejected

- GIVEN an open finding
- WHEN an operator attempts to resolve it with no reason
- THEN the system MUST reject the transition and append nothing

#### Scenario: An edited decision line is reported

- GIVEN a merged decision file whose resolution reason was later changed in place
- WHEN the audit projection is rebuilt
- THEN the change MUST be reported as a restated decision naming the commit that made it

#### Scenario: State is the fold of decisions over a recomputed finding

- GIVEN a finding acknowledged and then resolved with a reason
- WHEN the audit projection is rebuilt in a fresh clone
- THEN the finding MUST read as resolved with both decisions and their operators

### Requirement: Separation of duties without author surveillance

A rule MAY compare the actors recorded on a single change record, because that comparison is a property of
one record. A rule SHALL NOT group, count, rank, trend, or otherwise aggregate findings or records by human
author across records; the aggregation key type makes such a rule unwritable, and a test SHALL assert that
no rendered output carries a per-person total. A separation-of-duties finding SHALL cite the record, and no
surface or evidence pack SHALL present a per-person total or league table.

#### Scenario: A same-record actor comparison is accepted

- GIVEN a rule asserting that a change's recorded reviewer differs from its recorded author
- WHEN the rule runs
- THEN its findings MUST cite the change record

#### Scenario: No per-person totals in output

- GIVEN a completed run containing several separation-of-duties findings
- WHEN the read surface and an evidence pack render it
- THEN neither MUST present a total, ranking, or trend keyed to a person

### Requirement: Git-only baseline controls and not-observable controls

With the collector off for a repository, the system SHALL evaluate the controls the flow records can
evidence: the change is associated with a pull request, a `Spec:` reference names an accepted change, a
session is declared and its record is present, the change is not out-of-band, and no `conflicting-trailer`
gap exists. Every control that needs collector records (a reviewer distinct from the author, reviewer
independence, green checks, protection status, deployment linkage) SHALL be reported as `not-observable`
with the reason `collector-off`, never as evidenced and never as failed. An evidence pack SHALL list the
not-observable controls beside the evidenced ones.

#### Scenario: A baseline run evidences what git can see

- GIVEN a repository with the collector off and a change associated with a pull request, carrying a spec
  reference and a reported session
- WHEN the `change-control` level runs
- THEN the pull request, spec, and session controls MUST be evidenced for that change
- AND the reviewer and checks controls MUST be `not-observable` with reason `collector-off`

#### Scenario: A pack names what it could not see

- GIVEN a release range in a repository with the collector off
- WHEN the evidence pack is generated
- THEN it MUST list every not-observable control with its reason

### Requirement: Configurable reviewer independence

When collector records exist for a repository, a separation-of-duties rule SHALL express the independence it
requires as a level from the ordered vocabulary `none`, `distinct-model`, `distinct-provider`,
`distinct-human`, evaluated against the reviews the collector recorded on the change. Only reviews with
trust class `observed` SHALL satisfy a level above `none`: a human review from an account on the configured
approved reviewer list, or an agent review the collector confirmed against the platform's run record. A
review bound to a commit other than the merged head SHALL NOT satisfy the rule. The reviewer's provider
SHALL be the model's publisher, and the author's provider SHALL be every provider named by the change's
session records; a finding citing a provider comparison SHALL state that the author side is reported. The
requirement SHALL be configurable per repository and scopeable by path pattern with the strictest match
governing, SHALL NOT depend on team size, and SHALL require `distinct-human` on agent instruction files,
hooks, workflow files, and the telemetry and governance configuration regardless of the default.

#### Scenario: An agent review satisfies a cross-provider requirement

- GIVEN a change authored by an agent from one provider and reviewed by an agent from a different provider
- WHEN a rule requiring `distinct-provider` is evaluated
- THEN the rule MUST pass
- AND the finding record MUST name the reviewing provider

#### Scenario: The strictest matching scope governs

- GIVEN a repository requiring `distinct-provider` by default and `distinct-human` under a payment path
- WHEN a change touching that path is evaluated
- THEN `distinct-human` MUST be applied
- AND an agent-only review MUST produce a finding

#### Scenario: A stale review does not satisfy the rule

- GIVEN a change reviewed at a revision earlier than the one merged
- WHEN any independence level above `none` is evaluated
- THEN the change MUST be treated as unreviewed

#### Scenario: A workflow change requires a human reviewer

- GIVEN a repository whose default requirement is `distinct-provider` and a change editing a workflow file
- WHEN the change is evaluated with only an agent review
- THEN it MUST produce a finding requiring `distinct-human`

### Requirement: Reviewer class is disclosed, never laundered

Wherever a review is presented as evidence, the system SHALL state the reviewer class and, for an agent
reviewer, the independence level observed, the model and its publisher, and whether the review was
truncated. An evidence pack SHALL NOT present an agent review as a human review, SHALL NOT aggregate the two
into a single reviewed count, and SHALL state that whether an agent reviewer satisfies a given control is
the assessor's determination.

#### Scenario: A pack separates agent and human review

- GIVEN a window in which some changes had human reviewers and others had agent reviewers
- WHEN the evidence pack is exported
- THEN it MUST report the two classes separately
- AND it MUST NOT present a combined reviewed total

### Requirement: Paper-trail gaps are findings

The system SHALL read every gap the flow projection records (`undeclared-session`, `missing-session-record`,
`conflicting-trailer`, `out-of-band`, `unreachable-repository`) and every gap the collector records
(`missing-collector-record`, `restated-record`, `unknown-protection`) and SHALL raise each as a finding at
base level `hygiene` or higher, citing the gap type and the change or period it affects. A control SHALL NOT
be reported as evidenced for a change carrying a gap that removes the evidence the control relies on. An
evidence pack SHALL list every gap in its range beside the change it affects and SHALL state that the
system reports overrides rather than preventing them.

#### Scenario: An out-of-band change leaves every control unevidenced

- GIVEN a release range containing an out-of-band change
- WHEN the `change-control` level is evaluated
- THEN every control MUST be reported as not evidenced for that change
- AND the finding MUST cite the `out-of-band` gap

#### Scenario: A skipped hook appears in the pack

- GIVEN a release range containing a change with an `undeclared-session` gap
- WHEN the evidence pack is generated
- THEN the gap MUST be listed beside that change

### Requirement: Controls are labeled preventive or detective

For each control in each period, the system SHALL label the control `preventive` when the collector
recorded that the platform enforced it during that period and `detective` otherwise, including every
period with the collector off or with unknown protection status. No output SHALL describe a detective
control as preventing the behavior it detects.

#### Scenario: A collector-off period is detective

- GIVEN a period with the collector off
- WHEN a run evaluates the `change-control` level
- THEN each control MUST be labeled `detective`

#### Scenario: A pack does not overstate a detective control

- GIVEN a release range containing periods with and without recorded branch protection
- WHEN the pack is generated
- THEN each control MUST name its label per period
- AND no document MUST state that a detective control prevented unreviewed changes

### Requirement: Regulated data never enters the audit path

Records SHALL carry engineering metadata only. The system SHALL NOT ingest, store, or export cardholder data,
protected health information, or the contents of any record a standard governs; a finding and an evidence
pack SHALL cite identifiers, paths, commit references, and timestamps rather than payloads. The system SHALL
reject a record carrying an unclassified free-text payload field.

#### Scenario: A record carrying a payload is rejected

- GIVEN a collector record carrying the body of a deployed artifact
- WHEN it is loaded
- THEN the system MUST reject it and name the payload field

#### Scenario: An evidence pack cites without quoting

- GIVEN a finding on a change to a service that processes regulated data
- WHEN the evidence pack is exported
- THEN it MUST cite the change identifier, path, and timestamps
- AND it MUST NOT contain data from the records that service processes

### Requirement: The audit record is version-controlled and the local store is a projection

Durable audit records SHALL be version-controlled files in this repository, added through pull requests:
the registry overlay and governance configuration per repository, decision files, collector records, and
each evidence pack pinned by the manifest hash in its export record. The local store SHALL be a
canonical-JSON projection of those files plus the flow projection, rebuildable from a fresh clone
to a byte-identical file, and deletable without loss. Continuous-integration artifacts and run logs SHALL
NOT be the retention mechanism for anything a rule or a pack cites, and the system SHALL report each
source's effective retention horizon so a shortfall against a standard's period is a finding.

#### Scenario: The audit store rebuilds from the repositories alone

- GIVEN a fresh clone of this repository and the synced mirrors
- WHEN the audit projection is rebuilt
- THEN it MUST reproduce every finding state, exception, and pack reference
- AND it MUST be byte-identical to the projection on another machine at the same commits and ref tips

#### Scenario: An insufficient retention horizon is reported

- GIVEN a standard pack whose controls require a retention period longer than a configured source's horizon
- WHEN the configuration is evaluated
- THEN the system MUST report the shortfall naming the source and both periods

### Requirement: Evidence is scoped to released code

An evidence pack SHALL be scoped to a release range from the flow projection's release membership: the changes a
release contains, not changes that never reached a release. A pack SHALL name the release tag and the
commit it points at, the preceding release tag bounding the range, every change in that range with its
classification, any unmapped change, and the unreleased inventory as out of scope. At base level `regulated`
a pack SHALL additionally cite the collector's deployment record placing that release's commit in a named
environment, and SHALL be refused where no such record exists.

#### Scenario: A pack covers one release range

- GIVEN two consecutive release tags
- WHEN a pack is generated for the later one
- THEN it MUST cover exactly the changes that release contains
- AND it MUST name both tags and the commit the release points at

#### Scenario: Unreleased work is out of scope and said to be

- GIVEN changes after the newest release tag
- WHEN a pack is generated for that release
- THEN those changes MUST NOT appear as in-scope changes
- AND they MUST be reported as an unreleased inventory

#### Scenario: A regulated pack requires a deployment record

- GIVEN a repository at base level `regulated` and a release with no deployment record
- WHEN a pack is requested for that release
- THEN the system MUST refuse it and name the missing record

### Requirement: Evidence packs are generated, not stored

A pack SHALL be generated by walking the release range and rendering Markdown documents: an index, one
document per control listing the findings, the cited changes and records, the effective configuration, the
active exceptions, and the not-observable controls, and a manifest of the documents with their hashes.
Generation SHALL be deterministic: the same release range, records, rule versions, and configuration SHALL
produce byte-identical documents on any machine, and no value that varies between generations (a generation
timestamp, a hostname, an operator name) SHALL appear in hashed content. Exporting a pack SHALL append a
decision naming the release, the configuration, the rule versions, the projection hash, and the manifest
hash, so a pack regenerated later is checkable against the recorded hash. A pack SHALL state that it is
evidence for the named controls and SHALL NOT state that any system is compliant with a standard.

#### Scenario: Two machines generate the same pack

- GIVEN the same release range and projection on two machines
- WHEN each generates the pack
- THEN every document MUST be byte-identical
- AND the manifest hashes MUST match

#### Scenario: An export is verifiable without the files

- GIVEN an export record naming a release and a manifest hash
- WHEN the pack is regenerated from the repositories
- THEN its manifest hash MUST equal the recorded one
- AND a mismatch MUST be reported as a discrepancy naming what differs

#### Scenario: A pack makes no compliance claim

- GIVEN any generated pack
- WHEN its text is reviewed
- THEN it MUST NOT assert that any system is compliant with the standard

### Requirement: Productivity rule set over flow reads

The system SHALL ship a `productivity` rule set over the flow projection's spend and effort reads: cost per unit
of recorded effort by provider and by model, cost per spec reference, wait time, and rework. Every such
read SHALL report the number of changes excluded for lacking the unit it needs, and SHALL refuse to render a
comparison across providers when either side has fewer recorded changes than the configured minimum.

#### Scenario: A comparison with too little data is refused

- GIVEN one provider with twelve recorded changes and another with two
- WHEN a cost-per-story-point comparison is requested at a minimum of five
- THEN the system MUST refuse the comparison and name the provider that fell short

### Requirement: Seed rule sets

The repository SHALL ship seed files under `seeds/`: the base levels `hygiene`, `change-control`, and
`regulated`, the `pci-dss` and `hipaa` packs, and the `productivity` rule set, each mapping rule identifiers
to the controls they evidence. Every seed SHALL load into a fresh store without code changes, and no seed
description SHALL assert coverage of a standard.

#### Scenario: Loading seeds into a fresh store

- GIVEN a fresh store
- WHEN seeds are loaded
- THEN the base levels, both packs, and the productivity rule set MUST exist with their rules
- AND each rule MUST carry a control label and a valid aggregation key

### Requirement: Governance configuration is a file per repository

The governance configuration for a repository (base level, packs, independence level and path scopes,
approved reviewer list, collector setting) SHALL be a version-controlled file in this repository under
`config/<repository>.json`, changed only through a pull request. The Ledger SHALL render the effective
rule set before a change is applied, SHALL express a change as a proposed edit to that file, and SHALL
present a repository with no file as `hygiene` with an explicit statement that no level has been chosen.

#### Scenario: The effective rule set is shown before applying

- GIVEN an operator selects base level `change-control` and enables the `pci-dss` pack
- WHEN the change is previewed
- THEN The Ledger MUST list the rules that would run, their severities, and their controls
- AND the change MUST NOT be applied until it is committed through a pull request

#### Scenario: An unconfigured repository states its default

- GIVEN a repository in the registry with no configuration file
- WHEN an operator opens The Ledger
- THEN it MUST present the level as `hygiene`
- AND it MUST state that no level has been chosen

### Requirement: The Ledger gains a governance view

The Ledger SHALL gain a governance view beside its flow views, and the productivity rule set's
reads SHALL join its spend panels. The governance view SHALL present, per repository and across the
registry, the change population and any out-of-band change first, then controls in one of four states
(evidenced, evidenced-with-exception, not evidenced, not-observable) scoped to a selected release, each with
its preventive or detective label, active exceptions with reason, expiry, and operator, run history with the
configuration each run used, pack generation with the manifest hash beside any prior export's hash, and the
configuration preview expressed as a proposed file edit. The productivity panels SHALL show excluded counts
beside each figure and SHALL render a refusal as the panel's content. Every figure SHALL be traceable to
the records it was computed from, and a figure whose inputs cannot be enumerated SHALL NOT render. The
flow views SHALL be unchanged. No view SHALL present a compliance score, a percentage of a
standard satisfied, or any figure keyed to a person.

#### Scenario: No compliance score is presented

- GIVEN a run of a standard pack with some controls not evidenced
- WHEN the governance view renders
- THEN it MUST show each control's state
- AND it MUST NOT display a percentage, score, or compliance assertion

#### Scenario: An undersampled comparison renders as a refusal

- GIVEN one provider with twelve recorded changes and another with two, at a minimum of five
- WHEN a cross-provider comparison is requested
- THEN the panel MUST state that the comparison is refused and name the provider and its sample size

#### Scenario: The flow views survive the extension

- GIVEN the phase one Ledger rendering wait time and the unmerged queue
- WHEN the governance view is added
- THEN those panels MUST render exactly as phase one rendered them

#### Scenario: Person is not offered as a dimension

- GIVEN any panel with grouping options
- WHEN its dimensions are listed
- THEN no option MUST group by a person
