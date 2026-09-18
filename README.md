# Dev Ledger

Dev Ledger turns the commit histories of the repositories a team runs into the signals an engineer needs
to find where work waits, and then, as a second phase, into evidence someone outside the team can read. It
reads every repository over the SSH access a developer already has, fetches what the remote already
advertises (tags and pull head refs included), and rebuilds a projection that is byte-identical on any
machine that fetched the same ref tips. No platform API, no token, no workflow, no service.

Phase one, `add-flow-observability`, is observability: capture hooks and session files, a registry of
repositories, the projection, the flow signals (cycle time, wait time, the unmerged queue, batch size,
rework, escapes, spend per change), the four DORA keys approximated to the release tag, and The Ledger,
published for this repository at [salzayat.github.io/dev-ledger](https://salzayat.github.io/dev-ledger/). Phase two, `add-change-audit`, is compliance as a layer
over the same records: rules, levels and packs, findings you can quote by identifier, decisions you cannot
quietly edit, evidence packs that hash the same on any machine, and a governance view added to the same
Ledger. Its baseline needs nothing but git and says plainly which controls git alone cannot see; an
optional collector, running in this repository's own continuous integration with one read-only credential,
adds reviews, checks, protection, and deployments for the repositories that turn it on. It never claims
compliance and never resolves an identifier to a person.

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

The harness hook is a command: at the end of a session, pipe the harness's figures as JSON to
`./scripts/telemetry.sh session end --payload -`. A harness that does not state its figures can still leave
a transcript on disk: `session end --transcript <file>` sums the token counts from it and says so in the
record. The payload fields are listed in [`docs/contract.md`](docs/contract.md). At session start,
`./scripts/telemetry.sh session start --id <id>` records the identifier the commit hook writes as
`Session:` and the clock, so a payload may leave `startedAt` and `endedAt` to the commands. Order matters:
start the session, commit the work, then end the session and commit the record. `scripts/pr.sh` refuses to
open a pull request with no active session and no declaration; `--human-only` declares the branch, and
`--allow-undeclared` opens it as undeclared on purpose.
A commit made with no active session (before one starts, or after `session end` unsets it) carries no
`Session:` trailer at all, so its change reads `undeclared`: a gap the projection counts rather than a claim
about who did the work. `Session: none` means something narrower and is never written by default: it says a
person did this work without an agent, and an operator declares it per branch with
`./scripts/telemetry.sh session human-only` (or `--human-only` on `scripts/pr.sh`), cleared with
`session human-only --clear`.

## What The Ledger Shows

One page per repository, in four tabs, each answering one question:

- **Flow: where does work wait?** Wait time and cycle time from the pull head ref, so a rebase or squash
  does not erase them; velocity per week; merge frequency; the unmerged queue with each pull request's
  age, spend, and man hours, and a total of what is older than the registered age; batch size; work mix
  by commit type; flow efficiency (active seconds over cycle time); iterations (sessions and commits per
  change); spec lead time from a spec's first commit to the merge that archived it; rework with a
  per-repository ignore list; escapes after the newest release; check compliance.
- **DORA: how would a manager read it?** The four keys approximated to the release tag, the
  approximation named on each card, with lead time split into review and release lag.
- **Spend: what did it cost?** Reported spend over time and by cost class; subscription spend allocated
  across each period's sessions by agent run seconds, provisional while the month is open, never summed
  across currencies; what the plan worked out to per million input and output tokens, with cache reads
  beside it; the metered rate per provider where a harness reports cost directly; spend per spec,
  provider, model, and operator; cost per merged change, per released change, per release, and per unit
  of effort.
- **Records: what is the evidence?** The newest changes with their wait, cycle, lines, spend, man hours,
  sessions, and gaps, and every cited session and subscription record.

Every figure names its trust classes (`observed` from git, `reported` from a harness or an operator,
`allocated` from an apportioned amount), its excluded count, and the changes and records behind it, and
every cited commit shows its change's subject and links to the commit when the registry URL is a GitHub
remote. Undeclared and unreported changes and records without figures are counted and named, never read
as zero. Operators are a dimension: agents by provider and model in the plan's currency, humans by a
pseudonymous identifier in hours, never summed, never priced, and never resolved to a name or an email
address. The page is one self-contained HTML file with inline SVG, no script, and no loaded resource,
readable from a file URL, in light and dark. [`docs/methodology.md`](docs/methodology.md) explains each
figure.

## The Published Ledger

This repository's own board is published to GitHub Pages at
[salzayat.github.io/dev-ledger](https://salzayat.github.io/dev-ledger/), rebuilt on every push to `main` by
the `Ledger` workflow. It is built by the same `telemetry ledger --html` that writes the local page, so what
is published is what `npm run ledger` shows you.

Every pull request builds the same page without publishing it: the run uploads it as a `board` artifact and
writes the terminal render into the run's job summary, so a reviewer sees what a change does to the ledger
before it merges. Only a push to `main` deploys, and only while the repository is public; the deploy job
checks that itself rather than relying on anyone to remember.

Nothing generated is committed. `.telemetry/ledger.html` is untracked, the published page is built in the
workflow rather than stored in the tree, and the workflow uses no credential beyond the token the platform
issues to its own run.

### Reading this repository's own page

The published page is a real ledger over a young repository, and several of its figures need the story
behind them. Figures as of 2026-09-18, 71 changes on `main`:

- **44 changes read as undeclared.** 37 are the template's history from before the capture hooks existed.
  The rest were committed with no active session after the hook stopped defaulting `Session:`, which is
  the gap the projection is built to show. `scripts/pr.sh` now refuses that by default.
- **11 read as human-only**, including the three committed under the old default. A record says what was
  reported at the time, so they stand.
- **Reported spend is $0.00 over 3.4 million tokens; allocated spend is $100.00.** Every session is on a
  subscription, so no record carries a marginal cost. September's plan cost is recorded and apportioned
  across the 6 sessions that recorded agent run seconds; 13 recorded none and take no share. That works
  out to $73.68 per million input and output tokens, provisional until the month closes, and reads high
  because three of the six reported no tokens.
- **Flow efficiency reads 200%.** The earliest session records carry hand-entered start and end times that
  do not sit inside the change's cycle window. The figure is reported as it stands rather than clamped,
  because rounding it down would hide that two recorded figures disagree. Records written since take
  their times from `session start` and `session end`.
- **Work mix.** A merge commit's subject carries no type, so those changes take the most common type
  among their branch commits; `other` is left for changes whose commits carry no type at all.
- **Spec lead time is 13 minutes typical.** Specs here are archived in the same pull request that
  implements them, so the archive merge follows the first commit by about one cycle.
- **Releases per week is n/a.** One tag, `v0.1.0`. Lead time to release is 20.7 days, all of it merge to
  tag: the release lag, not the review queue.
- **Rework.** With the default ignore list it showed 754 pairs led by `plans/roadmap.md`, `README.md`, and
  `docs/methodology.md`, which every change here edits by design. The registry entry now ignores the
  roadmap, the README, `docs/`, and `openspec/`, so the pairs that remain are in code.
- **The queue lists a closed pull request.** Its pull head ref still exists, and git cannot say it was
  closed. The panel says so beside the number.

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
| `npm exec nx run capture:test`               | Run the capture package's tests.                                                                                  |
| `npm exec nx run flow:test`                  | Run the flow package's tests over fixture repositories built in a temporary directory.                            |
| `./scripts/check-hooks-current.sh`           | Warn when the hooks git will run are not the hooks in this working tree. Warns; never fails.                      |
| `./scripts/spec-status.sh`                   | Report each capability with an active OpenSpec change and its task completion.                                    |

`capture` and `flow` are source-only: `build` emits `.d.ts` files, and consumers resolve the source
through the `@dev-ledger/source` export condition, so no build step is needed to run anything.

### Why the hook check warns instead of failing

`core.hooksPath` may be relative, which git resolves against whichever working tree is current, or absolute,
which points every worktree at one directory. A worktree carrying the absolute form runs another checkout's
hooks, so a hook fixed on a branch never executes there, and a hook fixed and merged does not execute until
that checkout is updated. Nothing reports this on its own: a hook that is never read cannot say it was not
read.

`./scripts/check-hooks-current.sh` compares the hooks git will run with the `.githooks` of the current
working tree and names any that differ. It warns rather than failing because the stale checkout is often not
the committer's to fix, and blocking their commit would punish the wrong person for it.

## Repository Map

| Directory or file           | Purpose                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/capture`          | Session file schema, configuration, trailer parsing and validation                                                         |
| `packages/flow`             | Registry, sync, change grouping, association, timing, releases, signals, projection, cursors, The Ledger, the command line |
| `.githooks/`                | `prepare-commit-msg`, `commit-msg`, `pre-commit`, `pre-push`                                                               |
| `scripts/telemetry.sh`      | Entry point for every telemetry command                                                                                    |
| `scripts/ledger.sh`         | Sync, rebuild, render, and open The Ledger in one step; backs `npm run ledger`                                             |
| `telemetry.config.json`     | Effort vocabulary, spec pattern, cost allocation (on here: operator hours and cost classes)                                |
| `registry.json`             | The repositories the projection covers                                                                                     |
| `.telemetry/sessions/`      | Session files, tracked, one per session                                                                                    |
| `.telemetry/subscriptions/` | `plans.json` declarations and one cost record per billing period and plan, tracked                                         |
| `.telemetry/` (untracked)   | Mirrors, the projection, cursors: rebuilt, never committed                                                                 |
| `openspec/`                 | Accepted specs, the active changes, and the archive                                                                        |
| `docs/`                     | [`contract.md`](docs/contract.md), [`methodology.md`](docs/methodology.md), governance, orientation                        |

See [`docs/repository-orientation.md`](docs/repository-orientation.md) for the agent loop, the harness
layout, and the MCP boundary, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the change workflow.

## License

MIT. See [`LICENSE`](LICENSE).
