# Design: Add Hook Drift Check

## Compare content, not revisions

The tempting check is "is the checkout that owns `core.hooksPath` behind its remote", and it is the wrong
one. It needs a fetch, so it fails offline and slows every run; it reports drift that does not matter when
the commits behind touch no hook; and it misses drift that does matter when someone edits a hook without
committing it.

The question a contributor actually has is narrower: **will the hook that runs be the one in the tree I am
committing from?** That is answered by comparing the files under the effective `core.hooksPath` with the
`.githooks` of the current working tree — local, instant, and exact. When the two paths resolve to the same
directory there is nothing to compare and the check says so.

## Warn rather than fail

Everything else in `scripts/check.sh` is a gate. This one is not, for a reason worth stating: the drift is
usually in a checkout the person running the check does not own and may not be able to update, and failing
their commit for it would be punishing the wrong party for someone else's stale working tree.

The failure this closes was never that the wrong thing happened loudly. It was that nothing happened at all —
a hook that is never read cannot report that it was not read — and the cost was a merged fix that appeared to
fail on its own commits. A named warning with the exact remedy is the whole of what was missing.

## Three states, each named

- **Not installed.** `core.hooksPath` is unset, so no hook runs at all; the remedy is
  `./scripts/install-git-hooks.sh`.
- **Installed elsewhere and drifted.** The path resolves outside this working tree and at least one hook
  differs; the check names each differing hook and the checkout that supplies it.
- **Pointing at nothing.** The path resolves to a directory that holds none of the repository's hooks, which
  is a misconfiguration rather than drift.

Each is reported distinctly, because the remedies differ and a single "hooks are wrong" message would send
someone to the wrong one.

## The check reports and does not repair

It would be a small step from detecting the absolute override to rewriting it, and the check does not take
it. `core.hooksPath` is configuration an operator or their tooling set deliberately — this repository's own
worktrees carry the absolute form for a reason that belongs to the tooling that created them — and a check
that silently rewrote it would be changing the thing it is supposed to observe. It prints the command; a
person runs it.
