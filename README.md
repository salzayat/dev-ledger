# Dev Ledger

Dev Ledger reads the commit histories of the repositories a team runs and turns them into the signals an
engineer needs to find where work waits and what it cost. It needs only the SSH access a developer already
has: it mirror-fetches each repository, including tags and pull head refs, and rebuilds a projection that is
byte-identical on any machine holding the same ref tips. No platform API, no token, no service.

Phase one is observability: capture hooks and session records, a registry, the projection, the flow and
DORA reads, spend in three trust classes, and The Ledger, published for this repository at
[salzayat.github.io/dev-ledger](https://salzayat.github.io/dev-ledger/). Phase two, `add-change-audit`,
layers compliance over the same records and is drafted in `openspec/changes/`. Nothing is resolved to a
person. The repository is a fork of [spec-loop](https://github.com/salzayat/spec-loop) and keeps its
discipline: specs before code, evidence over trust, an agent harness with no credentials.

## Quick start

```bash
npm ci
./scripts/install-git-hooks.sh
npm run check
```

Register repositories in `registry.json`, then build and open the page:

```bash
npm run ledger
```

That runs `telemetry sync`, `telemetry rebuild`, and `telemetry ledger --html`, and opens the result.
`sync` is the only step that reaches the network, through `git fetch`. Registry fields, including
`measuredFrom`, `closedPullRequests`, `rework.ignore`, and `webUrl`, are listed in
[`docs/contract.md`](docs/contract.md).

## What gets recorded

Every record is committed with the work and read back from git. Schemas and fields are in
[`docs/contract.md`](docs/contract.md).

- **Trailers on every commit** made through the hooks: `Spec:`, `Session:`, `Change:`, and enabled effort
  units. A commit with no active session carries no `Session:` trailer and reads `undeclared`.
- **A session record per work session** under `.telemetry/sessions/`: provider, model, tokens, cost,
  agent run seconds, operator hours, and the local check outcome. Never a name, an email address, or a rate.
- **Plan declarations and period cost records** under `.telemetry/subscriptions/`: what a plan is arranged
  to cost, and what was paid each month. A subscription session records no marginal cost; the period
  record is apportioned across its sessions by agent run seconds under the trust class `allocated`.
- **Notes** under `.telemetry/notes/`: an operator's dated explanation of a figure, shown beside it.
- **Timesheets** under `.telemetry/timesheets/`: `./scripts/telemetry.sh timesheet close <YYYY-MM>`
  proposes each operator's hours by spec from the month's records; you confirm and commit.
- **Cost classes** in `.telemetry/classes.json`: one class per spec, set with
  `./scripts/telemetry.sh class set <spec> <rd|production>`, inherited by every record citing the spec.

With Claude Code, `.claude/settings.json` wires `scripts/harness/claude-code.sh` to `SessionStart` and
`SessionEnd`, so sessions start and end themselves. Any other harness runs `session start --id <id>` first
and pipes its figures to `session end --payload -` at the end, with `--transcript <file>` to sum tokens and
hours. `scripts/pr.sh` and the ledger workflow both refuse a pull request whose work is undeclared;
`--human-only` declares a branch's work done without an agent, and `--allow-undeclared` opens it as
undeclared on purpose.

## What The Ledger shows

One page per repository, in four tabs: **flow** (wait and cycle time, velocity as the relative complexity of tasks completed per week, the queue, batch size,
work mix, flow efficiency, iterations, spec lead time, rework, escapes, check compliance), **DORA** (the
four keys approximated to the release tag), **spend** (reported and allocated spend by period, cost class,
spec, provider, model, and operator; the plan's cost per token; cost per change and per release), and
**records** (recent changes, session and subscription records, notes).

Every figure names its trust class (`observed` from git, `reported` from a harness or an operator,
`allocated` from an apportioned amount), its excluded count, and the changes and records behind it.
Missing figures are counted, never read as zero. Agents are measured in the plan's currency and humans in
hours, never summed and never priced. The page is one file with inline SVG, no script, and no loaded
resource. Reviews, checks, and platform timestamps are not observed; git does not hold them.
[`docs/methodology.md`](docs/methodology.md) explains each figure.

## The published Ledger

The `Ledger` workflow builds the page on every pull request that touches more than prose, as a run
artifact and a job summary, and deploys it to GitHub Pages from `main` while the repository is public,
skipping the deploy when the projection has not changed. The mirror is cached between runs. It fetches over HTTPS with the
run's own token and uses no other credential. Nothing generated is committed.

## Commands

| Command                                          | What it does                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `npm run check`                                  | The full local gate: specs, harness, governance, docs, secrets, format, lint, tests.    |
| `npm run ledger [-- --no-open]`                  | Sync, rebuild, write `.telemetry/ledger.html`, and open it.                             |
| `./scripts/telemetry.sh sync`                    | Mirror-fetch every registered repository. `--entry NAME --fetch-url URL` overrides one. |
| `./scripts/telemetry.sh rebuild`                 | Rebuild the projection and print its hash.                                              |
| `./scripts/telemetry.sh ledger [--html]`         | Render The Ledger in the terminal, or as the page.                                      |
| `./scripts/telemetry.sh session ...`             | `start`, `end`, `human-only`, `figures`, `summary`.                                     |
| `./scripts/telemetry.sh subscription ...`        | `close <YYYY-MM>` proposes period records from `plans.json`; `record` writes one.       |
| `./scripts/telemetry.sh note add`                | Record why a figure reads the way it does.                                              |
| `./scripts/telemetry.sh validate`                | Validate every session, subscription, and note record.                                  |
| `./scripts/telemetry.sh configure`               | Serve the configuration surface on the loopback interface; never commits.               |
| `./scripts/telemetry.sh cursor <consumer>`       | Replay changes since a consumer's cursor and advance it.                                |
| `./scripts/telemetry.sh export --period YYYY-MM` | Write the month's statement as CSV (or `--format json`) to `.telemetry/statements/`.    |
| `./scripts/check-declared.sh <base> <head>`      | Fail when a range carries no `Session:` trailer and nothing declares it.                |
| `./scripts/check-hooks-current.sh`               | Warn when the hooks git runs are not the hooks in this tree.                            |

Each command prints its usage with no arguments. `capture` and `flow` are source-only: consumers resolve
the source through the `@dev-ledger/source` export condition, so nothing needs building to run.

## Repository map

| Path                    | Purpose                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/capture`      | Record schemas, configuration, trailers, the capture command line                                                                         |
| `packages/flow`         | Registry, sync, projection, signals, The Ledger, the flow command line                                                                    |
| `.githooks/`            | `prepare-commit-msg`, `commit-msg`, `pre-commit`, `pre-push`                                                                              |
| `scripts/`              | `telemetry.sh`, `ledger.sh`, `pr.sh`, the checks, and `harness/` adapters                                                                 |
| `registry.json`         | The repositories the projection covers                                                                                                    |
| `telemetry.config.json` | Effort vocabulary, spec pattern, cost allocation                                                                                          |
| `.telemetry/`           | Tracked: `sessions/`, `subscriptions/`, `notes/`. Untracked: mirrors, projection, cursors                                                 |
| `openspec/`             | Accepted specs, active changes, archive                                                                                                   |
| `docs/`                 | [`contract.md`](docs/contract.md), [`methodology.md`](docs/methodology.md), [`repository-orientation.md`](docs/repository-orientation.md) |

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the change workflow.

## License

MIT. See [`LICENSE`](LICENSE).
