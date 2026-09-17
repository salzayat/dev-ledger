# Dev Ledger

Dev Ledger turns the commit histories of the repositories a team runs into the signals an engineer needs
to find where work waits, and then, as a second phase, into evidence someone outside the team can read. It
reads every repository over the SSH access a developer already has, fetches what the remote already
advertises (tags and pull head refs included), and rebuilds a projection that is byte-identical on any
machine that fetched the same ref tips. No platform API, no token, no workflow, no service.

Phase one, `openspec/changes/add-flow-observability/`, is observability: capture hooks and session files,
a registry of repositories, the projection, the flow signals (cycle time, wait time, the unmerged queue,
batch size, rework, escapes, spend per change), and The Board. Phase two,
`openspec/changes/add-change-audit/`, is compliance as a layer over the same records: rules, levels and
packs, findings you can quote by identifier, decisions you cannot quietly edit, evidence packs that hash
the same on any machine, and a governance view added to the same Board. Its baseline needs nothing but
git and says plainly which controls git alone cannot see; an optional collector, running in this
repository's own continuous integration with one read-only credential, adds reviews, checks, protection,
and deployments for the repositories that turn it on. It never claims compliance and never aggregates by
person. Until phase one lands, this repository is the spec-loop template it was forked from, and the
sections below describe that template.

Forking this to start your own project? Read [`TEMPLATE.md`](TEMPLATE.md) first. For the thinking behind
it, read [Building Agentic Software Without Losing Discipline](https://binarylogic.live/blog/building-agentic-software-without-losing-discipline).

An agent working in this repo is a contributor, not an operator with free rein. Accepted OpenSpec
requirements define what the system should do. Nx projects define where the implementation lives.
Repository rules define how the work gets done. Automated checks supply the evidence that it's ready for
review. The agent harness gives agents reusable commands and skills, and its MCP access stays read-only or
limited to documented workspace operations. Publishing, deploying, and touching credentials stay with a
human, full stop.

The workflow follows a real engineering lifecycle: discovery, proposal, design, planning, implementation,
verification, review, archival. The things that make that lifecycle trustworthy on a human team apply here
too: clear dependencies, owned boundaries, review that doesn't care who wrote the code, explicit acceptance
criteria, recorded evidence. Agents can move faster through the loop. They don't get to skip the parts that
make it trustworthy.

What you end up with is a small lab for loop engineering. State the intended behavior. Make the smallest
change that satisfies it. Get fast local feedback. Enforce the same quality gates on every change. Feed what
you learn back into the next decision. The repo stays small and legible on purpose, so the lessons scale to
bigger agentic monorepos without hiding how the mechanics actually work. This is a work in progress by
design: today's `hello`/`greeter` pair is a starting workspace, not the finished shape. More examples and
deeper integrations will land here over time, each arriving through the same spec-driven loop the repo
teaches. Check the roadmap and OpenSpec change history to see where it's headed. Every accepted spec turns a
planned capability into a step you can hold accountable.

## Design Intent

The repository helps a team move from idea to reviewable implementation without losing the reasoning along
the way.

- **Contracts first.** Behavior lives in accepted OpenSpec requirements and scenarios, not in someone's
  head.
- **Bounded architecture.** Nx projects draw clear ownership and dependency lines.
- **Evidence over ceremony.** Every change ships with executable tasks and recorded verification.
- **Safe automation.** Agents can inspect and run bounded repository tasks. They don't get credentials or
  standing authority to publish, deploy, or act externally.
- **Portable foundations.** Examples avoid provider lock-in, network calls, and secrets.

## Quick Start

```bash
npm ci
npm run check
```

Install the local hooks once per clone:

```bash
./scripts/install-git-hooks.sh
```

`npm run check` runs strict OpenSpec validation, agent-harness and roadmap checks, documentation and secret
checks, then Nx formatting, linting, type checking, tests, and builds.

The secret check uses [gitleaks](https://github.com/gitleaks/gitleaks#installing) when it's on `PATH`, and
falls back to a narrow keyword pattern otherwise. Install gitleaks locally for real coverage — either way,
per [`SECURITY.md`](SECURITY.md), this check is a review guard, not a guarantee.

Forking this to start your own project? After `npm ci`, run `npm run rename -- <your-project-name>` to
rewrite every tracked identity string, npm scope, and file/directory name in one pass — see
[`TEMPLATE.md`](TEMPLATE.md) for the full one-time setup path.

## Key Commands

The repository keeps its common engineering actions executable and visible:

| Command                                        | What it does                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                | Runs the complete local quality gate: specs, harness, governance, docs, secrets, formatting, Nx checks, tests, and builds. |
| `npm exec nx show projects`                    | Lists the projects known to the Nx workspace.                                                                              |
| `npm exec nx graph`                            | Opens the workspace project and dependency graph.                                                                          |
| `npm exec nx run hello:test`                   | Runs the deterministic test target for the example library.                                                                |
| `npm exec nx run greeter:test`                 | Runs the test target for the second example library, which depends on `hello`.                                             |
| `npm exec openspec -- validate --all --strict` | Strictly validates every accepted and active OpenSpec artifact.                                                            |
| `./scripts/pr.sh`                              | Runs guarded checks, creates a commit, pushes a branch, and opens a pull request.                                          |

The agent harness adds workflow commands for the spec and review loop. `/next` picks up and implements the
next dependency-ready roadmap change. `/verify-change <name>` checks an active change without mutating it.
`/archive-change <name>` archives a fully verified change. `/pr` creates a guarded commit and pull request
through `scripts/pr.sh`. None of these commands grant an agent permission to publish, deploy, or take
external action without an explicit request.

## Skill Library

The reusable agent skill library lives in the canonical `.agent/skills/` directory. Skills give agents
focused working methods, not hidden authority. Discovery adapter paths like `.opencode/skills/` and
`.claude/skills/` just point back to this shared library.

| Skill                            | Focus                                                                 |
| -------------------------------- | --------------------------------------------------------------------- |
| `nx-workspace`                   | Explore projects, targets, dependencies, and workspace configuration. |
| `nx-run-tasks`                   | Run Nx targets and diagnose task failures.                            |
| `nx-generate`                    | Scaffold Nx projects and code through generators.                     |
| `nx-ai-agent-skills`             | Apply Nx-oriented practices when working with agents.                 |
| `openspec-change`                | Create a contract-backed OpenSpec change.                             |
| `openspec-contract-audit`        | Audit an active change for contract completeness and grounding.       |
| `openspec-lifecycle`             | Verify and archive changes with evidence and repository checks.       |
| `roadmap-execution`              | Select the next dependency-ready roadmap change.                      |
| `pull-request-automation`        | Prepare safe commit and pull-request automation.                      |
| `repository-harness-audit`       | Review commands, skills, adapters, and harness governance.            |
| `link-workspace-packages`        | Link packages in the npm workspace correctly.                         |
| `agent-rule`                     | Turn repository requests into durable agent rules.                    |
| `neutral-repository-attribution` | Keep repository-produced documentation and reports neutral.           |
| `nx-plugins`                     | Discover and add Nx technology plugins.                               |

Keep new reusable skills in `.agent/skills/`, document their boundaries, and expose them through the
existing discovery symlinks instead of copying divergent versions into adapter directories.

## Nx Workflow

```bash
npm exec nx show projects
npm exec nx graph
npm exec nx run hello:test
```

Project targets are intentionally explicit:

| Target      | Purpose                                       |
| ----------- | --------------------------------------------- |
| `lint`      | Static code-quality checks                    |
| `typecheck` | TypeScript validation without emitting output |
| `test`      | Deterministic project tests                   |
| `build`     | Emit type declarations                        |

`hello` and `greeter` are source-only: `build` emits `.d.ts` files for editor and downstream typecheck
support, not runnable `.js`. Other packages in this workspace import them directly by source through the
`@dev-ledger/source` package export condition (see `packages/greeter/src/index.ts`), so no build step is
required to consume them within this workspace. Use Nx targets rather than invoking project tooling
directly. As the workspace grows, applications should compose reusable libraries instead of stuffing
domain logic into presentation projects.

## Spec-Driven Workflow

OpenSpec is the behavioral source of truth here. The normal lifecycle:

1. Read the relevant accepted specs and current implementation.
2. Create and strictly validate `openspec/changes/<name>/`.
3. Record architecture in `design.md` and ordered work in `tasks.md`.
4. Implement only the contract-covered behavior.
5. Run `npm run check` and record exact evidence.
6. Verify and archive the change once every task is complete.

Each change artifact has its own job. `proposal.md` explains why. `design.md` explains how. `tasks.md`
explains execution. `specs/<capability>/spec.md` defines behavior. Plans teach sequencing; they don't
replace requirements.

See [`plans/spec-driven-workflow.md`](plans/spec-driven-workflow.md) and
[`docs/governance.md`](docs/governance.md) for the full workflow.

For the detailed directory map, authority boundaries, agent loop, harness adapters, and MCP boundary, see
[`docs/repository-orientation.md`](docs/repository-orientation.md).

Planning and dependency conventions are documented in
[`docs/dependency-patterns.md`](docs/dependency-patterns.md).

## Repository Map

| Path                | Responsibility                                                                  |
| ------------------- | ------------------------------------------------------------------------------- |
| `apps/`             | Future deployable applications                                                  |
| `packages/`         | Reusable libraries and domain logic; `hello` and `greeter` (depends on `hello`) |
| `openspec/specs/`   | Accepted behavioral contracts                                                   |
| `openspec/changes/` | Proposed, not-yet-archived changes                                              |
| `scripts/`          | Repository checks, hooks, and PR automation                                     |
| `.agent/`           | Canonical agent commands and skills                                             |
| `docs/`             | Durable policy and contributor explanations                                     |
| `plans/`            | Teaching sequence and roadmap, not requirements                                 |
| `.github/`          | CI, issue templates, and pull-request guidance                                  |

## Contributing

Read [`AGENTS.md`](AGENTS.md), the relevant accepted spec, and [`CONTRIBUTING.md`](CONTRIBUTING.md) before
making a change. Pull requests should explain the contract, the verification you ran, any checks you
skipped, and any generated output. The repository is licensed under the [MIT License](LICENSE).
