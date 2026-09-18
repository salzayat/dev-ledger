#!/bin/sh
# The Session: trailer in each of the three states the hook can be in. Runs real commits through the real
# prepare-commit-msg hook in a throwaway repository, because the defect this covers was a two-line default
# in that hook and a unit test of anything else would not have caught it.
set -eu

# Scrub every variable that would point a git child at the caller's repository, index, or object store.
# Without this, `git init` below can re-initialise the repository that invoked this script rather than the
# fixture — the same hazard the flow and capture packages guard against in their own git helpers.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_COMMON_DIR \
  GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_CEILING_DIRECTORIES GIT_NAMESPACE GIT_CONFIG_PARAMETERS || true

repo_root=$(pwd)
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

git init --quiet -- "$fixture"
[ -d "$fixture/.git" ] || fail "git init did not create a repository in the fixture"
mkdir -p "$fixture/.git/hooks"
cp "$repo_root/.githooks/prepare-commit-msg" "$fixture/.git/hooks/prepare-commit-msg"
chmod +x "$fixture/.git/hooks/prepare-commit-msg"
cd "$fixture"
git config user.email contributor@example.com
git config user.name Contributor

commit_with() {
  printf '%s\n' "$2" >"$1.txt"
  git add "$1.txt"
  git commit --quiet -m "chore(fixture): $1"
  git log -1 --format=%B
}

# 1. No active session and no declaration: no Session: trailer at all, so the change reads undeclared.
message=$(commit_with unknown a)
case "$message" in
  *"Session:"*) fail "a commit with no active session must carry no Session: trailer" ;;
esac
case "$message" in
  *"Change: "*) ;;
  *) fail "the Change: trailer must still be written" ;;
esac

# 2. An active session: its identifier, unchanged.
git config telemetry.session s-fixture
message=$(commit_with active b)
case "$message" in
  *"Session: s-fixture"*) ;;
  *) fail "an active session must write its identifier" ;;
esac

# 3. The window after a session ends: unset, so back to no trailer rather than none.
git config --unset telemetry.session
message=$(commit_with after c)
case "$message" in
  *"Session:"*) fail "a commit after a session ends must carry no Session: trailer" ;;
esac

# 4. A branch declared human-only: none, because an operator said so.
branch=$(git branch --show-current)
git config "branch.$branch.telemetry-human-only" true
message=$(commit_with declared d)
case "$message" in
  *"Session: none"*) ;;
  *) fail "a branch declared human-only must write Session: none" ;;
esac

# 5. An active session wins over the declaration: the agent did run.
git config telemetry.session s-again
message=$(commit_with both e)
case "$message" in
  *"Session: s-again"*) ;;
  *) fail "an active session must win over the human-only declaration" ;;
esac

printf '%s\n' "Trailer fixture tests passed"
