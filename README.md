# Dev Ledger

Dev Ledger turns the commit histories of the repositories a team runs into the signals an engineer needs
to find where work waits, and then, as a second phase, into evidence someone outside the team can read. It
reads every repository over the SSH access a developer already has, fetches what the remote already
advertises (tags and pull head refs included), and rebuilds a projection that is byte-identical on any
machine that fetched the same ref tips. No platform API, no token, no workflow, no service.

Phase one, `add-flow-observability`, is observability: capture hooks and session files, a registry of
repositories, the projection, the flow signals (cycle time, wait time, the unmerged queue, batch size,
rework, escapes, spend per change), the four DORA keys approximated to the release tag, and The Board,
published for this repository at [salzayat.github.io/dev-ledger](https://salzayat.github.io/dev-ledger/). Phase two, `add-change-audit`, is compliance as a layer
over the same records: rules, levels and packs, findings you can quote by identifier, decisions you cannot
quietly edit, evidence packs that hash the same on any machine, and a governance view added to the same
Board. Its baseline needs nothing but git and says plainly which controls git alone cannot see; an
optional collector, running in this repository's own continuous integration with one read-only credential,
adds reviews, checks, protection, and deployments for the repositories that turn it on. It never claims
compliance and never aggregates by person.

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
./scripts/telemetry.sh board     # render The Board in the terminal
./scripts/telemetry.sh board --html   # write .telemetry/board.html, the dashboard, and open it from a file URL
```

Or run all four as one: `npm run board`. `sync` is the only step that touches the network, and it uses
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

The harness hook is a command: at the end of a session, pipe the harness's figures as JSON to
`./scripts/telemetry.sh session end --payload -`. A harness that does not state its figures can still leave
a transcript on disk: `session end --transcript <file>` sums the token counts from it and says so in the
record. The payload fields are listed in [`docs/contract.md`](docs/contract.md). At session start,
`./scripts/telemetry.sh session start --id <id>` records the identifier the commit hook writes as
`Session:`. Order matters: start the session, commit the work, then end the session and commit the record.
A commit made after `session end` carries `Session: none` today and reads as human-only work, a defect
drafted as `fix-session-none-default`.

## What The Board Shows

Per repository and across the registry: cycle time and wait time (from the pull head ref, so a rebase or
squash does not erase them), the unmerged queue with each pull request's age and spend, batch size, merge
frequency, rework, escapes after the newest release, local check outcomes, spend per change, per unmerged
pull request, per spec, provider, model, and per unit of effort,
the four DORA keys approximated to the release tag with the approximation named on each card, spend over time
and by cost class, with every figure naming its trust classes, its excluded count, and the changes behind it. The dashboard is one
self-contained HTML page with inline SVG charts, no script, and no loaded resource, readable from a file URL, in light and
dark. Every cited commit shows the change's subject beside its abbreviated hash and links to the commit on GitHub when the
registry URL is a GitHub remote; with any other remote the same citations render unlinked. Undeclared and
unreported changes, and records whose harness supplied no figures, are counted and named, never read as
zero, on unmerged pull requests as on merged changes. Nothing is keyed to a person.
[`docs/methodology.md`](docs/methodology.md) explains each figure.

## The Published Board

This repository's own board is published to GitHub Pages at
[salzayat.github.io/dev-ledger](https://salzayat.github.io/dev-ledger/), rebuilt on every push to `main` by
the `Board` workflow. It is built by the same `telemetry board --html` that writes the local page, so what
is published is what `npm run board` shows you.

Every pull request builds the same page without publishing it: the run uploads it as a `board` artifact and
writes the terminal render into the run's job summary, so a reviewer sees what a change does to the board
before it merges. Only a push to `main` deploys, and only while the repository is public; the deploy job
checks that itself rather than relying on anyone to remember.

Nothing generated is committed. `.telemetry/board.html` is untracked, the published page is built in the
workflow rather than stored in the tree, and the workflow uses no credential beyond the token the platform
issues to its own run.

### Reading this repository's own page

The published page is a real board over a young repository, and some of its figures need the story behind
them:

- **37 of 53 changes read as undeclared.** They are the template's history, inherited from spec-loop before
  the capture hooks existed. The gap is stated, not hidden, and it will not shrink.
- **The three newest changes read as human-only.** They were committed after their session ended, so the
  hook wrote `Session: none`. That is the defect above, and until it is fixed the human-only count on this
  page overstates.
- **Spend is $0.00 over 1.7 million tokens.** The sessions run on a subscription, and the tool refuses to
  guess a price. Twelve records carry no figures at all: they predate transcript summing.
- **Releases per week is n/a.** One tag, `v0.1.0`, so there is no window to divide by. Lead time to release
  is 20.8 days, of which 20.7 is merge to tag: the release lag, not the review queue.
- **Rework shows 406 pairs**, most of them `plans/roadmap.md`, `README.md`, and `package-lock.json`. A
  per-entry ignore list is drafted in `add-flow-efficiency-and-work-mix`.
- **The queue lists a closed pull request.** Its pull head ref still exists, and git cannot say it was
  closed. The panel says so beside the number.

## What It Does Not See

Reviews, approvals, check outcomes, pull request open and close times, and whether an unmerged pull
request is open or closed. Git does not hold them. Phase two's optional collector adds them, and until a
repository turns it on, every control that needs them reads as not observable.

## Key Commands

| Command                                    | What it does                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `npm run check`                            | The complete local quality gate: specs, harness, governance, docs, secrets, formatting, Nx checks, tests, builds. |
| `./scripts/telemetry.sh sync`              | Mirror-fetch every registered repository over SSH. `--entry NAME --fetch-url URL` fetches one entry elsewhere.    |
| `./scripts/telemetry.sh rebuild`           | Rebuild the projection and print its content hash.                                                                |
| `./scripts/telemetry.sh board`             | Render The Board from the projection.                                                                             |
| `./scripts/telemetry.sh board --html`      | Write the dashboard to `.telemetry/board.html` and print its path.                                                |
| `npm run board`                            | Sync, rebuild, write the dashboard, and open it. The one command that goes from nothing to the page.              |
| `npm run board -- --no-open`               | The same without opening a browser; `--output PATH` writes somewhere other than `.telemetry/board.html`.          |
| `./scripts/telemetry.sh cursor <consumer>` | Replay changes since the consumer's cursor and advance it.                                                        |
| `./scripts/telemetry.sh validate`          | Validate session files against the schema.                                                                        |
| `./scripts/telemetry.sh session`           | Record a session start, or write a session file at session end (`--transcript <file>` sums its tokens).           |
| `./scripts/telemetry.sh session summary`   | Print the session records this branch adds, as the Markdown the PR helper embeds.                                 |
| `./scripts/telemetry.sh session figures`   | Sum a session transcript's token figures, to pass to `session end`.                                               |
| `npm exec nx run capture:test`             | Run the capture package's tests.                                                                                  |
| `npm exec nx run flow:test`                | Run the flow package's tests over fixture repositories built in a temporary directory.                            |
| `./scripts/spec-status.sh`                 | Report each capability with an active OpenSpec change and its task completion.                                    |

`capture` and `flow` are source-only: `build` emits `.d.ts` files, and consumers resolve the source
through the `@dev-ledger/source` export condition, so no build step is needed to run anything.

## Repository Map

| Directory or file         | Purpose                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/capture`        | Session file schema, configuration, trailer parsing and validation                                                        |
| `packages/flow`           | Registry, sync, change grouping, association, timing, releases, signals, projection, cursors, The Board, the command line |
| `.githooks/`              | `prepare-commit-msg`, `commit-msg`, `pre-commit`, `pre-push`                                                              |
| `scripts/telemetry.sh`    | Entry point for every telemetry command                                                                                   |
| `scripts/board.sh`        | Sync, rebuild, render, and open The Board in one step; backs `npm run board`                                              |
| `telemetry.config.json`   | Effort vocabulary, spec pattern, cost allocation (off by default)                                                         |
| `registry.json`           | The repositories the projection covers                                                                                    |
| `.telemetry/sessions/`    | Session files, tracked, one per session                                                                                   |
| `.telemetry/` (untracked) | Mirrors, the projection, cursors: rebuilt, never committed                                                                |
| `openspec/`               | Accepted specs, the active changes, and the archive                                                                       |
| `docs/`                   | [`contract.md`](docs/contract.md), [`methodology.md`](docs/methodology.md), governance, orientation                       |

See [`docs/repository-orientation.md`](docs/repository-orientation.md) for the agent loop, the harness
layout, and the MCP boundary, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the change workflow.

## License

MIT. See [`LICENSE`](LICENSE).
