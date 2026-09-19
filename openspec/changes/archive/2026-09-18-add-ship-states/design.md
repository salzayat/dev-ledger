# Design: Add Ship States

A change's commits are reachable from a tag even when later work replaced every line, so reachability alone
calls an overwritten attempt shipped. Blame at the tag answers the question the manager asks, what the
release contains, so a change is discarded when a tag carries it and none of its added lines survive there.
Survival is measured once, at the first tag carrying the change; later rewrites do not undo a release.

Lines are counted outside the rework ignore list, so lockfiles, generated records, and documentation the
repository already excludes from rework do not decide the state. A change that added no counted lines is
shipped, since there is nothing of it to lose. Cherry-picked commits count for the change they resolve to,
and a merge's own conflict lines never raise survival above what the change added.

Git cannot see a closed pull request, so the registry's existing `closedPullRequests` declaration decides
discarded; an undeclared unmerged pull request stays pending. A spend split by surviving lines is left out:
a session is counted whole under its change's state, and a split would be a declared rule of its own.

Blame runs per file the release window added lines to. On this repository's history the rebuild takes about
five seconds.
