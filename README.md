# Dev Ledger

Dev Ledger turns the commit histories of the repositories a team runs into the signals an engineer needs
to find where work waits, and then, as a second phase, into evidence someone outside the team can read. It
reads every repository over the SSH access a developer already has, fetches what the remote already
advertises (tags and pull head refs included), and rebuilds a projection that is byte-identical on any
machine that fetched the same ref tips. No platform API, no token, no workflow, no service.

Phase one is observability: capture hooks and session records, a registry, a deterministic projection,
the flow and DORA reads, spend in three trust classes, and The Ledger, published for this repository at
[salzayat.github.io/dev-ledger](https://salzayat.github.io/dev-ledger/). Phase two, `add-change-audit`,
layers compliance over the same records and is drafted in `openspec/changes/`. Nothing is resolved to a
person.

The repository was forked from [spec-loop](https://github.com/salzayat/spec-loop) and keeps its
discipline: specs before code, Nx project boundaries, evidence over trust, and an agent harness that gets
no credentials. For the thinking behind that, read
[Building Agentic Software Without Losing Discipline](https://binarylogic.live/blog/building-agentic-software-without-losing-discipline).

## Quick Start

```bash
npm ci
./scripts/install-git-hooks.sh
npm run check
```

Register the repositories you want to see in `registry.json` (name, SSH URL, default branch, release tag
pattern, thresholds, and a `webUrl` when the SSH URL uses a host alias), then:

```bash
./scripts/telemetry.sh sync      # mirror-fetch every registered repository over SSH
./scripts/telemetry.sh rebuild   # rebuild .telemetry/projection.json and print its hash
./scripts/telemetry.sh ledger     # render The Ledger in the terminal
./scripts/telemetry.sh ledger --html   # write .telemetry/ledger.html, the dashboard, and open it from a file URL
```

Or run all four as one: `npm run ledger`. `sync` is the only step that touches the network, and it uses
`git fetch` and nothing else. `rebuild` runs against the local mirrors. Two machines that fetched the same
ref tips print the same hash.

## What Gets Recorded

- **Trailers on every commit** made through the hooks: `Spec:`, `Session:`, `Change:`, and the enabled
  effort units, from values `scripts/pr.sh` stores in branch-local git configuration. `commit-msg` rejects
  a subject over 100 characters and any trailer the configuration does not allow.
- **One session file per work session**, written at session end by the harness hook
  (`./scripts/telemetry.sh session end --payload <file|->`), validated against `telemetry.config.json`,
  committed as its own commit, and carried by the merge. It records provider, model, tokens, cost,
  wall-clock, agent run seconds, billing kind, and the local check outcome. Never a name, an email address,
  or a rate. `pre-push` refuses to push while a finished session file is uncommitted.
- **Sessions on unmerged pull requests**, read from the pull head refs, so a failed experiment keeps its
  cost.
- **Plan declarations and period cost records.** `.telemetry/subscriptions/plans.json` declares each plan
  once, with effective-dated intervals carrying a unit amount and a seat count, so a rate change is an
  appended interval and not a rewrite. At month end, `./scripts/telemetry.sh subscription close <YYYY-MM>`
  proposes one cost record per declared plan and stops; you check it against the invoice and commit it. A
  subscription session records no marginal cost. The committed period record is what the plan cost, and
  the projection apportions it across the period's sessions by agent run seconds under the trust class
  `allocated`. `subscription record` still writes one record by hand.
- **Man hours, attributed.** A session's span between operator prompts is split three ways: the agent
  producing on its own, the person reading and typing, and the thread left idle past the cap. The person's
  share is recorded in hours and never converted to money; no record can hold a rate.
- **Cost in a named currency, cache reads and writes apart.** A metered record may carry
  `cost: { amount, currency }` (`costUsd` is read as USD), and a harness that reports cache reads and
  writes separately has them recorded separately.

With Claude Code, `.claude/settings.json` wires `scripts/harness/claude-code.sh` to `SessionStart` and
`SessionEnd`, so the session starts and ends itself: the model comes from the transcript, the plan from
`plans.json`, the commits from the branch. Any other harness pipes its figures as JSON to
`./scripts/telemetry.sh session end --payload -`, with `--transcript <file>` to sum tokens and hours from a
transcript; `session start --id <id>` records the identifier and the clock first. Fields are in
[`docs/contract.md`](docs/contract.md). A commit with no active session carries no `Session:` trailer and
reads `undeclared`; `session human-only` declares a branch's work done without an agent. Both
`scripts/pr.sh` and the ledger workflow refuse an undeclared pull request unless `--allow-undeclared` says
it is undeclared on purpose.

## What The Ledger Shows

One page per repository, four tabs: **flow** (wait and cycle time from the pull head ref, velocity, the
queue and what is older than the registered age, batch size, work mix, flow efficiency, iterations, spec
lead time, rework, escapes, check compliance), **DORA** (the four keys approximated to the release tag,
lead time split into review and release lag), **spend** (reported and allocated spend over time, by cost
class, spec, provider, model, and operator; what the plan worked out to per token; cost per change and
per release), and **records** (recent changes with their gaps, session and subscription records, notes).

Every figure names its trust class (`observed` from git, `reported` from a harness or operator,
`allocated` from an apportioned amount), its excluded count, and the changes and records behind it. Missing
figures are counted, never read as zero. Agents are measured in the plan's currency, humans in hours by a
pseudonymous identifier, never summed and never priced. The page is one file: inline SVG, no script, no
loaded resource. [`docs/methodology.md`](docs/methodology.md) explains each figure.

## The Published Ledger

The `Ledger` workflow builds the page on every pull request (as a `board` artifact and a job summary) and
deploys it to GitHub Pages from `main` while the repository is public, fetching over HTTPS with the run's
own token. It also refuses a pull request whose work is undeclared. Nothing generated is committed. The
page carries its own notes: `./scripts/telemetry.sh note add` records why a figure reads the way it does,
shown on the records tab dated and cited.

## What It Does Not See

Reviews, approvals, check outcomes, pull request open and close times, and whether an unmerged pull
request is open or closed. Git does not hold them. Phase two's optional collector adds them, and until a
repository turns it on, every control that needs them reads as not observable.

## Key Commands

| Command                                      | What it does                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run check`                              | The complete local quality gate: specs, harness, governance, docs, secrets, formatting, Nx checks, tests, builds. |
| `./scripts/telemetry.sh sync`                | Mirror-fetch every registered repository over SSH. `--entry NAME --fetch-url URL` fetches one entry elsewhere.    |
| `./scripts/telemetry.sh rebuild`             | Rebuild the projection and print its content hash.                                                                |
| `./scripts/telemetry.sh ledger`              | Render The Ledger from the projection.                                                                            |
| `./scripts/telemetry.sh ledger --html`       | Write the dashboard to `.telemetry/ledger.html` and print its path.                                               |
| `npm run ledger`                             | Sync, rebuild, write the dashboard, and open it. The one command that goes from nothing to the page.              |
| `npm run ledger -- --no-open`                | The same without opening a browser; `--output PATH` writes somewhere other than `.telemetry/ledger.html`.         |
| `./scripts/telemetry.sh cursor <consumer>`   | Replay changes since the consumer's cursor and advance it.                                                        |
| `./scripts/telemetry.sh validate`            | Validate session and subscription records against their schemas.                                                  |
| `./scripts/telemetry.sh session`             | Record a session start, write and commit a session file at session end, or declare a branch human-only.           |
| `./scripts/telemetry.sh session summary`     | Print the session records this branch adds, as the Markdown the PR helper embeds.                                 |
| `./scripts/telemetry.sh configure`           | Serve the configuration surface on the loopback interface only; writes configuration, never commits.              |
| `./scripts/telemetry.sh subscription close`  | Propose one cost record per declared plan for a period, from `plans.json`; you check it and commit.               |
| `./scripts/telemetry.sh session figures`     | Sum a session transcript's token figures and the operator's active seconds, to pass to `session end`.             |
| `./scripts/telemetry.sh subscription record` | Write and commit what a plan cost for one billing period, the input to allocated spend.                           |
| `./scripts/telemetry.sh note add`            | Record why a figure reads the way it does; rendered on the records tab, dated and cited.                          |
| `./scripts/check-declared.sh <base> <head>`  | Fail when a range carries no `Session:` trailer and nothing declares it; the ledger workflow runs it.             |
| `npm exec nx run capture:test`               | Run the capture package's tests.                                                                                  |
| `npm exec nx run flow:test`                  | Run the flow package's tests over fixture repositories built in a temporary directory.                            |
| `./scripts/check-hooks-current.sh`           | Warn when the hooks git will run are not the hooks in this working tree. Warns; never fails.                      |
| `./scripts/spec-status.sh`                   | Report each capability with an active OpenSpec change and its task completion.                                    |

`capture` and `flow` are source-only: `build` emits `.d.ts` files, and consumers resolve the source
through the `@dev-ledger/source` export condition, so no build step is needed to run anything.

## Repository Map

| Directory or file           | Purpose                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/capture`          | Session file schema, configuration, trailer parsing and validation                                                         |
| `packages/flow`             | Registry, sync, change grouping, association, timing, releases, signals, projection, cursors, The Ledger, the command line |
| `.githooks/`                | `prepare-commit-msg`, `commit-msg`, `pre-commit`, `pre-push`                                                               |
| `scripts/telemetry.sh`      | Entry point for every telemetry command                                                                                    |
| `scripts/ledger.sh`         | Sync, rebuild, render, and open The Ledger in one step; backs `npm run ledger`                                             |
| `telemetry.config.json`     | Effort vocabulary, spec pattern, cost allocation (on here: operator hours and cost classes)                                |
| `registry.json`             | The repositories the projection covers, with `measuredFrom`, `closedPullRequests`, and `rework.ignore` per entry           |
| `.telemetry/notes/`         | Operator notes on figures, tracked                                                                                         |
| `scripts/harness/`          | Harness hook adapters; `claude-code.sh` runs the session lifecycle from the harness's own hooks                            |
| `.telemetry/sessions/`      | Session files, tracked, one per session                                                                                    |
| `.telemetry/subscriptions/` | `plans.json` declarations and one cost record per billing period and plan, tracked                                         |
| `.telemetry/` (untracked)   | Mirrors, the projection, cursors: rebuilt, never committed                                                                 |
| `openspec/`                 | Accepted specs, the active changes, and the archive                                                                        |
| `docs/`                     | [`contract.md`](docs/contract.md), [`methodology.md`](docs/methodology.md), governance, orientation                        |

See [`docs/repository-orientation.md`](docs/repository-orientation.md) for the agent loop, the harness
layout, and the MCP boundary, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the change workflow.

## License

MIT. See [`LICENSE`](LICENSE).
