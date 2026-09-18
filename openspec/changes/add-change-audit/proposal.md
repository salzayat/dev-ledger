# Add Change Audit

## Why

This change is the second phase of `dev-ledger`, built one week after `add-flow-observability` tagged
`v0.1.0`, and it answers the question phase one deliberately does not: can the records a team already keeps
stand as evidence for a named control. Phase one gives it the `capture` and `flow` packages, the registry,
the SSH sync, the projection, the flow signals, and The Board. None of that has a consumer: nothing reads
the projection against a rule, records a finding someone has to answer for, or produces a document an
assessor can read. The `.githooks` and `scripts/pr.sh` phase one extended are not changed here.

An earlier design was drafted inside the Binary Logic repository as `add-engineering-auditor` and
`add-governance-dashboard`, over a telemetry design that carried platform facts into every audited
repository through a ledger workflow. That design is split here into a git-only baseline, which needs
nothing but the SSH access phase one uses and evidences the controls git can prove, and an optional
collector, which runs in this repository's own continuous integration with one read-only credential and
adds the platform facts (reviews, checks, protection, deployments) for the repositories that turn it on.
Every control that needs the collector says so when it is off, rather than being inferred or failed.

## What Changes

- Add `packages/audit`, depending on the `flow` and `capture` packages in-workspace: rules as
  versioned code with a typed aggregation key that has no member for a person; base levels (`off`,
  `hygiene`, `change-control`, `regulated`) and standard packs (`pci-dss`, `hipaa`) as JSON mapping rule
  identifiers to controls; extension by adding rule identifiers and suppression only by an exception with
  an operator, a reason, and an expiry.
- Findings recomputed and content-addressed, never stored; decisions (acknowledge, resolve, exception,
  export) appended to a version-controlled file per audited repository through a pull request; a finding's
  state as the fold of its decisions; in-place edits reported as restated decisions.
- A git-only baseline: the controls the phase one projection can evidence (through a pull request, spec
  present, session declared and reported, not out-of-band, no conflicting trailer) are evaluated, and every
  control needing platform records is a fourth state, `not-observable`, with the reason `collector-off`.
- An optional collector (`packages/audit/src/collector/`, `.github/workflows/collector.yml`), enabled per
  repository in its configuration file, running on a schedule in this repository with a read-only
  credential stored here only, appending `observed` records (pull request to commit mapping, times,
  reviews with the commit each approved, checks, deployment runs, protection status) to
  `records/<repository>/` through a standing pull request opened with the run's own token, and re-deriving a
  look-back period to catch a hand-edited record as a restatement.
- Reviewer independence (`none`, `distinct-model`, `distinct-provider`, `distinct-human`, path-scoped,
  strictest match governing, human required on hook, workflow, instruction, and configuration paths),
  evaluated only against observed reviews; reviewer class disclosed everywhere and never merged into one
  reviewed count.
- Controls labeled preventive or detective per period, detective whenever the collector is off or the
  protection status is unknown.
- Paper-trail gaps from the projection and from the collector raised as findings, leaving dependent
  controls unevidenced.
- Evidence packs scoped to a release range, generated as deterministic Markdown with a manifest hash pinned
  in the export record, listing evidenced, excepted, not-evidenced, and not-observable controls, and
  claiming evidence for named controls and never compliance.
- Metadata only: a record carrying an unclassified free-text payload is rejected.
- A governance configuration file per repository (`config/<repository>.json`), changed only through a pull
  request, with the effective rule set rendered before a change is applied.
- The Board gains a governance view beside the flow views: controls in four states, exceptions,
  run history, pack generation, and the configuration preview, with a citation on every figure, no score,
  and no person dimension. The productivity rule set's reads join the existing spend panels with excluded
  counts beside each figure and refusals rendered as content.
- `scripts/audit.sh` (`run`, `findings`, `ack`, `resolve`, `except`, `pack`, `verify`, `rebuild`), with
  `scripts/telemetry.sh board` rendering the extended Board.

## Dependencies

`add-flow-observability` (phase one; this change is selected only after it is archived and `v0.1.0` is
tagged).

## Non-Goals

- No compliance certification. A pack is evidence for named controls; no output claims a system is
  compliant with any standard.
- No identifier resolved to a person anywhere, including evidence packs. `add-operator-dimension` admits a
  pseudonymous operator as a dimension of the flow reads, so this change no longer forbids aggregating by
  that identifier; it forbids resolving one to a name or an email address, and forbids pricing a human
  operator's hours at any rate. A rule may compare the actors on one change record.
- No credential outside this repository's continuous integration, and none by default. The collector is
  off until a repository's configuration turns it on and a maintainer provisions the credential.
- No workflow in any audited repository. Producing agent reviews inside an audited repository is a later
  change; this one only records reviews the platform already holds.
- No change to the `capture` and `flow` packages' schemas or to the flow views of The Board beyond adding
  the governance view. Anything the audit layer needs from them is a follow-on change to phase one's
  capabilities, not a silent edit inside this one.
- No ingestion of regulated data. Findings and packs cite identifiers, paths, and timestamps, never
  payloads.
- No operator-authored rule language, extension declarations, or pack-upgrade diffing. Rules are code; a
  team extends by configuration and exceptions.
- No `distinct-session` independence level. Two sessions of one model share the same failure modes.
- No second read surface. The Board is the one surface, here extended with a governance view.
- No standard beyond `pci-dss` and `hipaa`. Others are packs a later change or a team authors against the
  same seed format.
