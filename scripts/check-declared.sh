#!/bin/sh
# Fails when a range of commits carries no Session: trailer and nothing declares the work: neither a
# `Session:` line in the pull request body (PR_BODY) nor an explicit `Session: undeclared` override.
#
#   ./scripts/check-declared.sh <base> <head>
set -eu
base=${1:?base ref}
head=${2:?head ref}
body=${PR_BODY:-}
in_commits=$(git log --format=%B "$base..$head" 2>/dev/null | grep -c '^Session: ' || true)
case "$body" in
  *"Session: undeclared"*) printf '%s\n' "Declared check: the pull request declares its work undeclared on purpose"; exit 0 ;;
  *"Session: "*) printf '%s\n' "Declared check passed (session in the pull request body)"; exit 0 ;;
esac
if [ "${in_commits:-0}" -gt 0 ]; then
  printf '%s\n' "Declared check passed ($in_commits commits carry a Session: trailer)"
  exit 0
fi
printf '%s\n' "Declared check failed: no commit in $base..$head carries a Session: trailer and the pull request declares nothing." >&2
printf '%s\n' "Start a session before the work (./scripts/telemetry.sh session start), declare the branch human-only (scripts/pr.sh --human-only), or open it as undeclared on purpose (scripts/pr.sh --allow-undeclared)." >&2
exit 1
