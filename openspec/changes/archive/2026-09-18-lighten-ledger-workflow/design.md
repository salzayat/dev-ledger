# Design: Lighten Ledger Workflow

The mirror is safe to cache because the projection is deterministic over ref tips: a fetch into a warm
mirror ends at the same tips a cold clone would. The deploy skip compares the hash `rebuild` already prints
with the one recorded at the last deploy, kept in the same cache. Prose-only pull requests skip the build
because nothing they change can reach the projection, but they must not skip the declared-work gate, so
that gate now lives in the check workflow, which runs on every pull request regardless of paths.
