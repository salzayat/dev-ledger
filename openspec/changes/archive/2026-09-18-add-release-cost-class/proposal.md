# Add Release Cost Class

## Why

With every spec declared `rd` and an `rd` default, the class panel showed one class and no split. The rule
for this repository is that work that ships is production and every other effort is R&D: work that reaches
a release tag is production, and merged work no tag carries, and pull requests that never merged, are R&D.
The ledger already knows which changes each release carries, so the class can follow that fact.

## What Changes

- A declared release rule in `classes.json`, `telemetry class set --release <released> <unreleased>`,
  resolved after the session's class, the trailer, and the spec's declaration, and before the default.
- Sessions on unmerged pull requests are classified and counted on the class panel.
- This repository replaces its blanket spec list and default with the rule `production` / `rd`.
