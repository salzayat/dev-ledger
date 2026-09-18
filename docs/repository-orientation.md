# Repository Orientation

This page is the detailed map for contributors and repository agents. It explains where work belongs and
which files have authority. The accepted contracts under `openspec/specs/` are authoritative for behavior;
this page is guidance, not a replacement for those contracts.

## Layout

```text
.
├── apps/                 Future thin, deployable applications
├── packages/             Reusable libraries and domain logic
│   ├── capture/          Session file schema, configuration, trailers (phase one)
│   └── flow/             Registry, sync, projection, signals, The Ledger, the command line (phase one)
├── openspec/
│   ├── specs/            Accepted behavioral requirements and scenarios
│   └── changes/          Active proposals; archive completed changes
├── scripts/              Repository checks, hooks, PR automation, and telemetry.sh
├── .githooks/            prepare-commit-msg, commit-msg, pre-commit, pre-push
├── telemetry.config.json Effort vocabulary, spec pattern, cost allocation
├── registry.json         The repositories the projection covers
├── .telemetry/           sessions/ (tracked); mirrors, projection, cursors (untracked)
├── .agent/
│   ├── commands/         Canonical shared agent commands
│   └── skills/           Canonical shared agent skills
├── .opencode/            OpenCode discovery adapters; config is at root
├── .claude/              Claude discovery adapters
├── .agents               Plural-agent discovery symlink to `.agent/`
├── AGENTS.md             Repository rules for agents and contributors
├── CLAUDE.md             Symlink to `AGENTS.md`
├── docs/                 Durable policy and contributor explanations
├── plans/                Teaching workflow and roadmap, never requirements
├── docs/dependency-patterns.md  Roadmap and OpenSpec dependency conventions
├── .github/              CI, issue templates, and pull-request guidance
├── nx.json               Workspace-level Nx configuration
├── package.json          Package manager scripts and workspace metadata
├── opencode.json         Project OpenCode and MCP configuration
└── dist/, .nx/,          Ignored generated output and Nx cache
```

## Ownership And Authority

| Area                | Put here                                           | Authority                               |
| ------------------- | -------------------------------------------------- | --------------------------------------- |
| Implementation      | `packages/`, then thin `apps/`                     | Code, constrained by accepted specs     |
| Workspace execution | `nx.json`, project `project.json`, package scripts | Nx projects and targets                 |
| Behavior            | `openspec/specs/`                                  | Accepted requirements and scenarios     |
| Proposed change     | `openspec/changes/<name>/`                         | Proposal, design, tasks, and delta spec |
| Governance          | `AGENTS.md`, `CONTRIBUTING.md`, `docs/`            | Repository operating rules              |
| Teaching sequence   | `plans/`                                           | Explanatory sequencing only             |
| Agent integration   | `.agent/`, adapter symlinks, `opencode.json`       | Discovery and bounded tooling only      |

When prose and a contract disagree, update the governing OpenSpec artifact before implementation. Do not
put domain behavior in scripts, reports, agent prompts, or presentation code.

## Accepted Specification Index

Open the single governing spec for your task instead of scanning them all. Each lives at
`openspec/specs/<capability>/spec.md`.

| Capability                      | Scope                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `repository-foundation`         | The small, deterministic Nx starting point: the `capture` and `flow` packages.   |
| `telemetry-capture`             | Session files, trailers, hooks, and the telemetry configuration (phase one).     |
| `flow-observability`            | Registry, SSH sync, projection, signals, releases, cursors, and The Ledger.      |
| `repository-documentation`      | Repository intent, authority boundaries, `AGENTS.md`, and orientation guidance.  |
| `repository-planning`           | Roadmap sequencing, OpenSpec dependency declarations, and readiness evidence.    |
| `workflow-governance`           | Executable PR automation and pre-merge dependency-readiness checks.              |
| `dev-ledger-governance`         | Canonical agent harness layout, bounded MCP access, CI parity, and roadmap sync. |
| `ci-governance`                 | How Dependabot updates pass quality gates without weakening human-change checks. |
| `agent-attribution`             | Neutral role labels and no provider or marketing branding in produced content.   |
| `public-repository-maintenance` | Public metadata, ownership, support, security, and publication safeguards.       |
| `template-rename-tooling`       | Renaming the template's identity strings when a fork adopts a new project name.  |

## Resuming Work

Before reading prior session context, the roadmap, or every active change's `tasks.md`, run:

```bash
./scripts/spec-status.sh
```

It reports each capability with an active OpenSpec change and that change's task completion, computed live
from `openspec/changes/` and `openspec list --json` — nothing here is hand-maintained, so there is no
separate progress document to go stale. Use its output to load only the one active change relevant to your
task instead of the full session.

## Agent Loop

1. Read `AGENTS.md`, the relevant accepted spec, and the current implementation.
2. Find or create `openspec/changes/<name>/` with `proposal.md`, `design.md`, `tasks.md`, and a delta spec.
3. Validate the change: `npm exec openspec -- validate <name> --strict`.
4. Implement the smallest contract-covered slice in the appropriate Nx project.
5. Run the focused Nx target, then `npm run check`; record exact evidence in the change tasks and PR.
6. Run `/verify-change` and archive only after all tasks and verification requirements are complete.

Use `npm exec nx show projects` and `npm exec nx show project <project> --json` to inspect the workspace.
Use Nx targets such as `npm exec nx run flow:test`; do not invoke project tooling directly when an Nx target
exists.

Read [`TEMPLATE.md`](../TEMPLATE.md) first if you are setting this repository up as the start of a new
project rather than contributing to this one; it is a one-time rename/replace/verify checklist that precedes
the agent loop below.

`packages/flow` is the worked example of a dependent package. It imports `capture`'s typed exports via
`@dev-ledger/capture`, declared as both an npm workspace dependency and an Nx `implicitDependencies`
entry. That import resolves at typecheck and test time through the `@dev-ledger/source` package export
condition, so no build step is required. [`docs/contract.md`](contract.md) lists the versioned schemas
`flow` reads and phase two pins; [`docs/methodology.md`](methodology.md) explains every figure on The Ledger.

When adding a new package that depends on another, follow the same shape: a `package.json` with a matching
`exports` map, a `project.json` with `implicitDependencies`, and a `node --conditions=@dev-ledger/source`
test target.

Use [`docs/dependency-patterns.md`](dependency-patterns.md) when adding roadmap entries, declaring OpenSpec
predecessors, or replacing a template example after a clone or fork.

Use [`docs/agent-attribution.md`](agent-attribution.md) when writing repository reviews, reports, or
documentation that must use neutral attribution.

## Agent Harness

`.agent/commands/` and `.agent/skills/` are the only canonical locations. The following paths are discovery
adapters and must remain symlinks, never copied directories or files:

- `.opencode/command` -> `../.agent/commands`
- `.opencode/skills` -> `../.agent/skills`
- `.claude/commands` -> `../.agent/commands`
- `.claude/skills` -> `../.agent/skills`
- `.agents` -> `.agent`
- `CLAUDE.md` -> `AGENTS.md`

Run `./scripts/check-harness.sh` after changing commands, skills, or adapters. Restart the agent harness after
changing project-local commands or skills because integrations load them at startup.

## MCP Boundary

Project MCP configuration lives in `opencode.json`. It enables only the local `nx-mcp` adapter, whose command
is `npx nx mcp`. Its intended use is read-only repository inspection, Nx project graph and target discovery,
and bounded Nx task execution. It is an adapter to the workspace, not an authority grant.

Do not add credentials, `.env` values, remote MCP URLs, deployment or publishing tools, external mutation,
arbitrary shell servers, or unrestricted network access to project configuration. Agent permissions and user
authorization still govern any task that changes files or runs commands. After changing `opencode.json`,
quit and restart OpenCode so the configuration is reloaded.

## Generated And Sensitive Files

Do not commit `node_modules/`, `dist/`, `.nx/`, coverage, build metadata, `.env` files, credentials, tokens,
or private keys. Examples must stay deterministic, local-only, and credential-free.
