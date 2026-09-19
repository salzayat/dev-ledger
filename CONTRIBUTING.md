# Contributing

Dev Ledger is a learning repository. Contributions should improve the foundation, demonstrate a
repeatable practice, or make an existing boundary clearer. Avoid adding framework-specific or provider-
specific machinery unless it supports a documented teaching goal.

## Before Editing

1. Read `AGENTS.md`.
2. Read the relevant accepted spec under `openspec/specs/`.
3. Find or create the active OpenSpec change that governs the work.
4. Inspect the current Nx project graph and related implementation.

Use [`docs/repository-orientation.md`](docs/repository-orientation.md) when locating implementation,
specification, governance, or agent integration files.
Use [`docs/agent-attribution.md`](docs/agent-attribution.md) for neutral contributor and reviewer attribution.

Behavior changes require a change under `openspec/changes/`. Documentation and workflow changes must
update the relevant docs in the same pull request. Keep requirements, architecture, tasks, and teaching
prose in their respective documents; do not duplicate contracts across README and plans.

## Local Setup

This is setup for changing dev-ledger itself. To measure your own repositories, follow the README.

```bash
npm ci
./scripts/install-git-hooks.sh
npm run check
```

Install [gitleaks](https://github.com/gitleaks/gitleaks#installing) locally for full secret-scan coverage;
the check falls back to a narrower pattern when it's absent, which still runs on every commit but is a
review guard, not a guarantee (see [`SECURITY.md`](SECURITY.md)).

Useful Nx commands:

```bash
npm exec nx show projects
npm exec nx graph
npm exec nx run capture:test
```

## Change Workflow

1. Draft `proposal.md`, `design.md`, `tasks.md`, and the capability spec.
2. Run `npm exec openspec -- validate <change> --strict`.
3. Implement the smallest change that satisfies the scenarios.
4. Run `npm run check` and any changed-path end-to-end command.
5. Update docs and task evidence after implementation.
6. Archive the change only when all tasks and verification are complete.

## Commit And PR Rules

Use small conventional commits: `type(scope): summary`. Do not commit credentials, `.env` files,
dependency directories, caches, generated output, or unexplained fixtures. Do not bypass hooks with
`--no-verify`.

Every pull request should state:

- What changed and why
- Which OpenSpec requirement or change it supports
- Exact verification commands and results
- Skipped checks and reasons, or `None`
- Whether data or generated output changed

Use `.github/pull_request_template.md` and `./scripts/pr.sh` for guarded PR automation after explicit
authorization.

`./scripts/pr.sh` adds one generated block to every description it creates, between
`<!-- telemetry:begin -->` and `<!-- telemetry:end -->`: the session records the branch adds, with each
record's session identifier, provider and model, figures, and local check outcome, followed by the record
itself. It lands inside `## Data / generated output` when the body has that heading, and as its own
section otherwise. A body passed with `--body-file` is never rewritten — the block is appended within the
section, and the `Spec:` and `Session:` trailers are appended after it so the merge commit carries them.
A record whose harness supplied no figures is named as missing, never rendered as a zero.

## Review Standard

Review for behavioral correctness, clear boundaries, reproducibility, documentation freshness, and
teaching value. A passing check proves only that the check passed; it does not replace design or code
review.
