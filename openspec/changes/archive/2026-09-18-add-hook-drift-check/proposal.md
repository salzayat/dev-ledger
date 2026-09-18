# Add Hook Drift Check

## Why

The hooks that run are not always the hooks in your working tree, and nothing says so.

`scripts/install-git-hooks.sh` sets `core.hooksPath` to the relative path `.githooks`, which git resolves
against whichever working tree is current — correct for a repository with worktrees, because each one then
runs its own hooks. But a worktree may carry its own `config.worktree`, and this repository's does:

```
[core]
	hooksPath = /Users/…/dev-ledger/.githooks
```

An absolute path to the main checkout. Every commit made from that worktree runs the main checkout's hooks,
so a hook fixed on a branch does not take effect there, and a hook fixed and merged does not take effect
until the main checkout is updated.

That is not hypothetical. `fix-session-none-default` removed a defaulted `Session:` trailer, merged, and its
own follow-up commits kept carrying the defaulted value because the main checkout was twenty-six commits
behind and supplying the pre-fix hook. The fix looked like it had failed on itself. The symptom is silent by
construction: a hook that is never read cannot report that it was not read.

## What Changes

- Add a check that compares the hooks git will actually run — the files under the effective `core.hooksPath`
  — against the `.githooks` of the current working tree, and warns, naming each hook that differs and the
  command that resolves it.
- Warn without failing. A stale sibling checkout is not always the committer's to fix, and blocking a commit
  on it would punish the wrong person; the gap this closes is that nothing said anything at all.
- Report the two other states plainly: hooks not installed, and `core.hooksPath` pointing somewhere that
  holds no hooks.
- Wire it into `scripts/check.sh` and document it beside the other repository checks.

## Dependencies

None. This adds a check over existing configuration and depends on no active change.

## Non-Goals

- No change to `core.hooksPath`, to `scripts/install-git-hooks.sh`, or to any worktree's configuration. The
  check reports; an operator decides.
- No network access and no comparison against a remote. The question is whether the hooks that will run
  match the tree you are committing from, which is answerable from local files alone.
- No failing build. The check warns; making it fatal is a separate decision with a separate cost.
- No change to any hook's behaviour.
