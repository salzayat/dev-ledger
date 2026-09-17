# dev-ledger-governance Specification

## Purpose

Define the canonical agent harness layout, bounded tooling access, and restart and adapter rules for repository
agents.

## Requirements

### Requirement: The agent harness has one canonical source

The repository MUST store project commands under `.agent/commands/` and project skills under
`.agent/skills/`. Agent-specific discovery paths MUST resolve to those directories through symlinks or an
equivalent explicitly verified adapter, rather than copied content. An adapter file that cannot be a
symlink because its target agent uses a different frontmatter format (such as OpenCode-native command or
agent files) MUST be verified by the harness check: the check MUST fail when such a file is untracked or
lacks required frontmatter, so no unverified or divergent content can sit in an adapter directory
unnoticed. A skill's `description:` frontmatter field, which loads into every agent session regardless of
whether the skill is invoked, MUST state only trigger conditions and scope; it MUST NOT restate rationale
or elaboration that the skill body already carries. A skill MUST correspond either to a technology actually
configured in this workspace (present in `nx.json`, a package manifest, or the CI workflow) or to a
generic, technology-independent workflow this repository itself uses (such as OpenSpec authoring or PR
automation); a skill describing an unconfigured technology or the opposite direction of this repository's
own purpose (importing an existing project into Nx, rather than being forked outward) MUST NOT ship by
default.

#### Scenario: Verify shared harness topology

- **GIVEN** a clean checkout
- **WHEN** a contributor runs the harness check
- **THEN** canonical directories, command front matter, skill front matter, and all documented links pass

#### Scenario: Reject unverified adapter content

- **GIVEN** a non-symlink file is placed under an agent adapter directory such as `.opencode/commands/` or
  `.opencode/agents/`
- **WHEN** the harness check runs
- **THEN** the check fails unless that file is tracked and carries valid frontmatter

#### Scenario: Skill description carries scope, not rationale

- **GIVEN** a skill's `description:` field contains a sentence explaining why the skill behaves as it does
- **WHEN** that same explanation already appears in the skill's body
- **THEN** removing the sentence from the description does not reduce which distinct requests trigger the
  skill
- **AND** the description retains every trigger phrase and scope statement needed to distinguish it from
  other skills

#### Scenario: A skill for unconfigured technology does not ship by default

- **GIVEN** a skill describes a technology (a CI provider integration, a frontend framework) with no
  corresponding configuration anywhere in this workspace
- **WHEN** the repository's default skill set is reviewed
- **THEN** that skill is absent, or the workspace configuration needed to make it applicable is present

### Requirement: Agent tools have bounded MCP access

The repository MUST document MCP configuration paths and the capabilities exposed to agents. The default
configuration MUST be read-only for source inspection and bounded Nx task discovery/execution, MUST NOT
contain credentials, and MUST NOT grant unrestricted arbitrary network or shell authority.

#### Scenario: Configure a supported local agent

- **GIVEN** a contributor selects a supported agent integration
- **WHEN** the documented non-interactive setup command is run
- **THEN** the agent can discover the repository guidance and documented MCP configuration without copying
  commands or skills

### Requirement: Governance checks cannot silently disappear in CI

The CI workflow MUST run the same aggregate governance and Nx quality command documented for local use.
Required validation tools MUST be pinned or their absence MUST fail the check instead of silently skipping
the corresponding gate. A gate that degrades to a fallback when its preferred tool is absent MUST use
matching logic that actually detects the case it claims to on every supported platform, and MUST NOT
depend on provider-specific credential names. When a precondition of the Nx quality targets is missing —
such as unlinked workspace packages — the aggregate check MUST fail with an explicit, actionable message
naming the remedy, rather than surfacing a misleading downstream error from a later target. A change that
touches only agent harness files (`.agent/`, `.agents`, `.claude/`, `.opencode/`) MUST NOT satisfy the
documentation-freshness requirement on its own; it MUST be paired with an actual documentation, README,
`AGENTS.md`, `CONTRIBUTING.md`, or OpenSpec update, the same as any other implementation change. When the
CI-computed diff range has no real base commit (an all-zero SHA), a check that compares content MUST NOT
crash on the malformed range; it MUST either skip explicitly with a stated reason, or substitute a
deliberately conservative range, chosen per the check's own risk (a documentation check may skip; a secret
scan MUST NOT skip and instead scans from the repository's root commit). A binary downloaded over the
network for use in CI MUST be verified against a checksum published by its source before use. A secret
check's passing result MUST state which engine actually ran, so a pass is interpretable rather than
ambiguous between full and fallback coverage.

#### Scenario: Run the CI-equivalent check locally

- **WHEN** a contributor runs `npm run check` after `npm ci`
- **THEN** OpenSpec, harness, documentation, secret, formatting, lint, typecheck, test, and build checks
  either run successfully or report an explicit actionable failure

#### Scenario: Fallback secret scan matches a spaced assignment

- **GIVEN** the preferred secret scanner is not installed and the fallback pattern runs
- **WHEN** a staged change adds a credential assignment with whitespace around `=` on a supported platform
- **THEN** the fallback pattern matches it rather than silently passing

#### Scenario: Unlinked workspace packages fail with an actionable message

- **GIVEN** the workspace package links under `node_modules/` are absent
- **WHEN** a contributor runs the aggregate check
- **THEN** it fails before the Nx quality targets with a message naming the remedy (such as `npm install`)
- **AND** it does not surface a bare module-resolution error as the first symptom

#### Scenario: A harness-only change does not document itself

- **GIVEN** a staged change touches only files under `.agent/`, `.agents`, `.claude/`, or `.opencode/`
- **WHEN** the documentation freshness check runs
- **THEN** it fails, the same as any other implementation change with no documentation update
- **AND** it does not accept the harness change itself as satisfying its own requirement

#### Scenario: A malformed zero-SHA diff range does not crash a check

- **GIVEN** `CHECK_DIFF_RANGE` has an all-zero base commit SHA (a new branch's first push, or a
  repository's first push after this template is generated)
- **WHEN** the documentation freshness check or the secret scan runs
- **THEN** neither crashes with a git plumbing error
- **AND** the documentation check skips with an explicit stated reason
- **AND** the secret scan instead scans from the repository's root commit rather than skipping

#### Scenario: A downloaded CI tool is checksum-verified

- **GIVEN** CI downloads a pinned tool release (such as gitleaks) over the network
- **WHEN** the download step runs
- **THEN** it verifies the artifact's checksum against a value published by the tool's own source before
  using it

#### Scenario: A passing secret check states its engine

- **WHEN** `check-secrets.sh` passes
- **THEN** its output states whether `gitleaks` or the narrower fallback pattern produced that result

### Requirement: Roadmap status reflects OpenSpec state

The roadmap MUST link each planned capability to its governing OpenSpec change and MUST distinguish pending,
blocked, and complete work. A capability MUST NOT be marked complete while its governing change has unchecked
tasks or lacks documented verification.

#### Scenario: Detect roadmap drift

- **GIVEN** a roadmap row references an active change with incomplete tasks
- **WHEN** the roadmap freshness check runs
- **THEN** it reports the row as pending or drifted rather than accepting an unqualified complete status

### Requirement: The roadmap command reuses prior context when no parameter is supplied

The canonical `/roadmap` command MUST use the immediately preceding user request as its capability context
when invoked without a parameter. Explicit user arguments MUST override prior conversational context. The
command MUST still inspect repository state and ask one concise question when phase position or dependencies
remain genuinely ambiguous.

#### Scenario: Empty roadmap invocation continues the prior request

- GIVEN the preceding user request describes a concrete repository capability
- WHEN the contributor invokes `/roadmap` without a parameter
- THEN the command uses that request as the capability description
- AND it determines phase position and dependencies from the request and repository evidence when possible

#### Scenario: Explicit roadmap arguments override prior context

- GIVEN the preceding conversation discusses one capability
- WHEN the contributor invokes `/roadmap` with a different explicit capability parameter
- THEN the command uses the explicit parameter
- AND it does not silently substitute the earlier conversation
