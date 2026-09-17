# Add Flow Observability

## Why

This repository is a fresh fork of spec-loop, renamed to `dev-ledger`, and it exists to answer one
question for engineers: where does work wait, and what does it cost, across every repository a team runs.
The template it starts from records nothing about that. `.githooks/commit-msg` validates a
`type(scope): summary` subject and refuses one over 100 characters, `.githooks/pre-commit` refuses a commit
on `main` and runs `scripts/check.sh`, and `scripts/pr.sh` builds a pull request body from a template or a
file. None of them writes a spec reference, a session identifier, or a change identifier onto a commit, and
nothing records what an agent session spent, when a branch's last commit was authored, or how long it then
sat before merging. `packages/hello` and `packages/greeter` are the template's teaching examples, marked
`TEMPLATE:REPLACE`, and this change replaces them.

An earlier design of this capability was drafted inside the Binary Logic repository as
`add-engineering-telemetry`. It reached for platform facts (reviews, checks, pull request open times) through
a ledger workflow that wrote records back into the audited repository by pull request, plus offline
verification of the platform's merge signatures for repositories without that workflow. Those are compliance
facts, and they made the observability half carry a mechanism it did not need. This change keeps the half
that git can supply over the SSH access a developer already has, and leaves platform facts to the
second phase, `add-change-audit`, which adds them as an option.

## What Changes

- Replace `packages/hello` with `packages/capture`: the versioned session file schema and validator, the
  `telemetry.config.json` schema (effort vocabulary, cost allocation block, cost classes), and the hooks
  that write `Spec:`, `Session:`, `Change:`, effort, and `Cost-Class:` trailers and commit a session file at
  session end. Session files carry provider, model, tokens, cost, wall-clock, agent run seconds, billing
  kind, the local check outcome, and, only when cost allocation is enabled, operator active seconds under an
  idle cap and a pseudonymous operator identifier. Never a name, an email address, or a rate.
- Replace `packages/greeter` with `packages/flow`, depending on `capture` the way `greeter` depended on
  `hello`: a registry of repositories by SSH URL, a `sync` that mirror-fetches each including tags and pull
  head refs, a projection in canonical JSON that is byte-identical on any machine that fetched the same ref
  tips, and the flow signals over it.
- A change, not a commit, as the unit, for squash, merge commit, and rebase merges alike, associated with a
  pull request offline by subject or by patch identity against a pull head ref, and classified as
  `pull-request` or `out-of-band` with no third state.
- Timing read from the pull head ref, so cycle time and wait time survive a rebase or a squash, and absent
  with a reason rather than zero when there is no pull head.
- Flow signals per repository and across the registry: cycle time, wait time, the unmerged queue and its
  age, batch size, merge frequency, rework, escapes after a release tag, local check outcomes, and spend per
  change, spec, provider, and model, each with its excluded count and trust classes, and each able to
  raise a signal over a registry threshold. Undeclared and unreported changes are counted, never zeroed.
- Releases from tag ancestry, with cherry-picks resolved by patch identity and unmapped and unreleased
  changes listed.
- Cursor-based consumers, so the projection is a log a consumer resumes from.
- The Board, one read surface over the projection, with a citation on every figure and no person dimension.
- `scripts/telemetry.sh` (`session`, `validate`, `sync`, `rebuild`, `cursor`, `board`) and the hook
  installer extending `scripts/install-git-hooks.sh`.
- A versioned contract (session schema, trailer vocabulary, registry format, projection schema) that the
  second phase, `add-change-audit`, builds on.

## Dependencies

None.

## Non-Goals

- No platform API, token, workflow, hosted service, or database. Everything runs on git working copies
  and mirrors. `git fetch` over SSH is the only network call.
- No reviews, check outcomes, protection status, or platform timestamps. Git does not hold them; the
  second phase's optional collector does.
- No findings, rules, levels, exceptions, or evidence packs. A signal here has no lifecycle; the auditor is
  the second repository.
- No per-person figure anywhere, and no person offered as a dimension. The pseudonymous operator identifier
  exists only for the cost allocation export, which is a later change in this repository, and no read here
  uses it.
- No retrieval of token or cost figures from any model provider. The harness reports them and they are
  recorded as reported.
- No offline verification of platform merge signatures. Association by subject and patch identity is
  weaker, is recorded as the method used, and is enough for the question this repository answers.
