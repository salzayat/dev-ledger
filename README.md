# Dev Ledger

Engineering management numbers for teams that include agents: what a feature cost, how much of the spend
was R&D, how many hours a person billed, how fast the work moves, and where it waits. Dev Ledger reads them
from git, using the access your engineers already have, and shows them on one page where every number
links to the commit or record behind it. No platform token and no service.

See it running on this repository: [salzayat.github.io/dev-ledger](https://salzayat.github.io/dev-ledger/).

## Measure your repositories

1. **Install the ledger.**

   ```bash
   git clone git@github.com:salzayat/dev-ledger.git && cd dev-ledger && npm ci
   ```

2. **Register the repositories** in `registry.json`: a name, the SSH URL, the default branch, and the release
   tag pattern for each. Fields are in [`docs/contract.md`](docs/contract.md).

3. **Build the page.**

   ```bash
   npm run ledger
   ```

   Wait and cycle time, the queue, the DORA keys, and velocity from task lists work on any repository
   straight away, from git alone.

4. **Install capture in each repository** for spend, hours, and R&D against production. From the ledger
   checkout, run the following, then commit the `telemetry.config.json` it writes into that repository:

   ```bash
   ./scripts/install-capture.sh ~/code/your-repo --operator op-1 --plan claude-max --provider anthropic --claude
   ```

   It adds two hook shims to that repository's `.git/hooks` and never touches its commit style or checks.
   With `--claude`, Claude Code sessions there start and end themselves. Any other harness runs
   `session start` before the work and `session end` after it.

5. **Record what the plan cost** each month, from that repository:
   `<ledger>/scripts/telemetry.sh subscription record --plan claude-max --period 2026-09 --amount 100 --currency USD`.
   Declare each spec's class once with `class set <spec> rd`, close each month's hours with
   `timesheet close <YYYY-MM>`, and export the month with `export --period <YYYY-MM>` from the ledger
   checkout.

A plan shared across repositories is recorded in one of them today, and only that repository's sessions take
a share of it.

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

One page per repository. A headline states the typical wait, cycle, active share, and the period's spend in
words, each linked to its panel, above five figures with a trend beside each. Below it, three views, each with
sub-views: **Metrics** (Flow: wait and cycle time, flow efficiency, rework, escapes, check compliance,
iterations, spec lead time; DORA: the four keys approximated to the release tag; Throughput: velocity as the
relative complexity of tasks completed per week, merge frequency, batch size, work mix), **Economics**
(Spend: reported and allocated spend by period, cost class, spec, provider, and model, and the plan's cost
per token; Effort: hours, operators, cost per unit of effort, spend on unmerged pull requests), and
**Records** (Changes, Queue, Notes). Every panel leads with its figure; its methodology and excluded count
fold beneath it, and its citations follow.

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

| Command                                          | What it does                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm run check`                                  | The full local gate: specs, harness, governance, docs, secrets, format, lint, tests.            |
| `npm run ledger [-- --no-open]`                  | Sync, rebuild, write `.telemetry/ledger.html`, and open it.                                     |
| `./scripts/telemetry.sh sync`                    | Mirror-fetch every registered repository. `--entry NAME --fetch-url URL` overrides one.         |
| `./scripts/telemetry.sh rebuild`                 | Rebuild the projection and print its hash.                                                      |
| `./scripts/telemetry.sh ledger [--html]`         | Render The Ledger in the terminal, or as the page.                                              |
| `./scripts/telemetry.sh session ...`             | `start`, `end`, `human-only`, `figures`, `summary`.                                             |
| `./scripts/telemetry.sh subscription ...`        | `close <YYYY-MM>` proposes period records from `plans.json`; `record` writes one.               |
| `./scripts/telemetry.sh note add`                | Record why a figure reads the way it does.                                                      |
| `./scripts/telemetry.sh validate`                | Validate every session, subscription, and note record.                                          |
| `./scripts/telemetry.sh configure`               | Serve the configuration surface on the loopback interface; never commits.                       |
| `./scripts/telemetry.sh cursor <consumer>`       | Replay changes since a consumer's cursor and advance it.                                        |
| `./scripts/telemetry.sh export --period YYYY-MM` | Write the month's statement as CSV (or `--format json`) to `.telemetry/statements/`.            |
| `./scripts/install-capture.sh <repo>`            | Install capture in another repository: hook shims, operator, plan, and the Claude Code adapter. |
| `./scripts/check-declared.sh <base> <head>`      | Fail when a range carries no `Session:` trailer and nothing declares it.                        |
| `./scripts/check-hooks-current.sh`               | Warn when the hooks git runs are not the hooks in this tree.                                    |

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
