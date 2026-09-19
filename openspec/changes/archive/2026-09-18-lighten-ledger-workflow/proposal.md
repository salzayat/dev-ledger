# Lighten Ledger Workflow

## Why

The ledger workflow clones the mirror from nothing on every run, builds a page for pull requests that
change only prose, and deploys even when the projection's bytes are the ones already published. None of it
costs money on a public repository; all of it is work with no reader.

## What Changes

- The bare mirror is cached between runs keyed on the commit, so `sync` is an incremental fetch.
- A pull request that changes only docs, plans, specs, the harness, or Markdown does not build a page;
  every push to the default branch still does.
- The deploy is skipped when the projection hash equals the last deployed one.
- The declared-work gate moves to the check workflow, which every pull request runs, so a prose-only pull
  request is still refused when its work is undeclared.

## Dependencies

None.

## Non-Goals

- No change to what the page shows or how it is built; the projection is a function of the ref tips, so a
  warm mirror cannot produce a different page.
