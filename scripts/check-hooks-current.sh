#!/bin/sh
# Warns when the hooks git will actually run are not the hooks in this working tree.
#
# `core.hooksPath` may be relative, which git resolves against the current working tree, or absolute, which
# points every worktree at one directory. A worktree carrying the absolute form runs another checkout's
# hooks, so a hook fixed here — or fixed, merged, and not yet pulled there — never executes, and nothing
# says so: a hook that is never read cannot report that it was not read.
#
# This warns and never fails. The drift is usually in a checkout the person running it does not own.
set -eu

repo_root=$(git rev-parse --show-toplevel)
own_hooks="$repo_root/.githooks"

configured=$(git -C "$repo_root" config --get core.hooksPath 2>/dev/null || true)

if [ -z "$configured" ]; then
  printf '%s\n' "Hook check: no core.hooksPath is configured, so no git hook will run."
  printf '%s\n' "  Install them with: ./scripts/install-git-hooks.sh"
  exit 0
fi

# A relative path belongs to whichever working tree is current; an absolute one is taken as given.
case "$configured" in
  /*) effective=$configured ;;
  *) effective="$repo_root/$configured" ;;
esac

resolve() {
  # `cd` + `pwd` resolves symlinks and `..` without requiring realpath, which is not portable.
  (cd "$1" 2>/dev/null && pwd) || printf '%s' "$1"
}

if [ ! -d "$effective" ]; then
  printf '%s\n' "Hook check: core.hooksPath is $configured, which is not a directory, so no git hook will run."
  printf '%s\n' "  Reinstall them with: ./scripts/install-git-hooks.sh"
  exit 0
fi

effective_real=$(resolve "$effective")
own_real=$(resolve "$own_hooks")

if [ "$effective_real" = "$own_real" ]; then
  printf '%s\n' "Hook check passed (hooks run from this working tree)"
  exit 0
fi

drifted=""
missing=""
present=0
for hook in "$own_hooks"/*; do
  [ -f "$hook" ] || continue
  name=$(basename "$hook")
  other="$effective_real/$name"
  if [ ! -f "$other" ]; then
    missing="$missing $name"
    continue
  fi
  present=$((present + 1))
  if ! cmp -s "$hook" "$other"; then
    drifted="$drifted $name"
  fi
done

if [ "$present" -eq 0 ] && [ -n "$missing" ]; then
  printf '%s\n' "Hook check: core.hooksPath is $effective_real, which holds none of this repository's hooks."
  printf '%s\n' "  That is a misconfiguration rather than drift. Reinstall with: ./scripts/install-git-hooks.sh"
  exit 0
fi

if [ -z "$drifted" ] && [ -z "$missing" ]; then
  printf '%s\n' "Hook check passed (hooks at $effective_real match this working tree)"
  exit 0
fi

printf '%s\n' "Hook check: the hooks git will run are not the hooks in this working tree."
printf '%s\n' "  Running from: $effective_real"
printf '%s\n' "  This tree:    $own_real"
[ -n "$drifted" ] && printf '%s\n' "  Differs:     $drifted"
[ -n "$missing" ] && printf '%s\n' "  Absent there:$missing"
printf '%s\n' "  Commits made here run the first set. If that checkout is behind, update it:"
printf '%s\n' "    git -C $(dirname "$effective_real") pull --ff-only"
printf '%s\n' "  This is a warning, not a failure."
exit 0
