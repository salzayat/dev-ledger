# Add Capture Install

## Why

The ledger measured one repository fully: its own. The git reads work on any registered repository, but
spend, hours, and R&D need the capture hooks, and those only ran inside this checkout. `telemetry.sh` looked
for the tool inside whatever repository it ran in, the Claude Code adapter did the same, and `pre-commit`
runs this repository's own quality gate. A team could not point the ledger at its repositories and get the
numbers it is for.

## What Changes

- `scripts/telemetry.sh` and the Claude Code adapter resolve the tool from their own location and act on
  the repository they run in.
- `scripts/install-capture.sh <repository>` installs capture there: shims for `prepare-commit-msg` and
  `pre-push` in its `.git/hooks`, the operator, plan, and provider in its local git configuration, a
  `telemetry.config.json` when it has none, and with `--claude` the adapter wired to Claude Code. It keeps
  an existing hook (running it first under `--force`), and refuses a repository whose hooks live elsewhere
  (`core.hooksPath`), printing the two lines to add instead.
- The README leads with measuring your own repositories; contributor setup stays in CONTRIBUTING.

## Non-Goals

- No change to the measured repository's commit style or checks.
- No allocation of one plan across repositories; a shared plan is recorded in one repository for now.
