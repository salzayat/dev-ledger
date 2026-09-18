#!/bin/sh
# The hook drift check in each state it reports. Builds throwaway repositories rather than touching this
# one, and scrubs the git environment first so `git init` cannot re-initialise the caller's repository.
set -eu

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_COMMON_DIR \
  GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_CEILING_DIRECTORIES GIT_NAMESPACE || true

repo_root=$(pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

# A repository carrying this repository's check and a .githooks of its own.
make_repo() {
  target=$1
  mkdir -p "$target/scripts" "$target/.githooks"
  git init --quiet -- "$target"
  [ -d "$target/.git" ] || fail "git init did not create a repository"
  cp "$repo_root/scripts/check-hooks-current.sh" "$target/scripts/check-hooks-current.sh"
  cp "$repo_root/scripts/install-git-hooks.sh" "$target/scripts/install-git-hooks.sh" 2>/dev/null || true
  printf '%s\n' '#!/bin/sh' 'echo original' >"$target/.githooks/prepare-commit-msg"
  chmod +x "$target/.githooks/prepare-commit-msg"
}

run_check() {
  (cd "$1" && ./scripts/check-hooks-current.sh 2>&1)
}

# 1. Not installed: no core.hooksPath at all.
make_repo "$work/unset"
output=$(run_check "$work/unset")
case "$output" in
  *"no core.hooksPath is configured"*) ;;
  *) fail "an unset core.hooksPath must be named as such: $output" ;;
esac
case "$output" in
  *install-git-hooks.sh*) ;;
  *) fail "the unset case must name the installer" ;;
esac

# 2. Installed in this tree: the relative path every checkout resolves for itself.
make_repo "$work/own"
git -C "$work/own" config core.hooksPath .githooks
output=$(run_check "$work/own")
case "$output" in
  *"Hook check passed"*) ;;
  *) fail "hooks in this working tree must pass quietly: $output" ;;
esac

# 3. Drifted: an absolute path to another checkout whose hook differs.
make_repo "$work/local"
make_repo "$work/other"
printf '%s\n' '#!/bin/sh' 'echo CHANGED' >"$work/other/.githooks/prepare-commit-msg"
git -C "$work/local" config core.hooksPath "$work/other/.githooks"
output=$(run_check "$work/local")
status=$?
case "$output" in
  *"are not the hooks in this working tree"*) ;;
  *) fail "drift must be reported: $output" ;;
esac
case "$output" in
  *prepare-commit-msg*) ;;
  *) fail "the drifted hook must be named: $output" ;;
esac
[ "$status" -eq 0 ] || fail "drift must warn, not fail"

# 4. Matching content at another path: no drift to report.
make_repo "$work/local2"
make_repo "$work/same"
git -C "$work/local2" config core.hooksPath "$work/same/.githooks"
output=$(run_check "$work/local2")
case "$output" in
  *"Hook check passed"*) ;;
  *) fail "identical hooks elsewhere must report no drift: $output" ;;
esac

# 5. Pointing at a directory holding none of the repository's hooks.
make_repo "$work/local3"
mkdir -p "$work/empty"
git -C "$work/local3" config core.hooksPath "$work/empty"
output=$(run_check "$work/local3")
case "$output" in
  *"holds none of this repository's hooks"*) ;;
  *) fail "an empty hooks directory must be named a misconfiguration: $output" ;;
esac

# 6. The check changes nothing it observes.
before=$(git -C "$work/local" config --get core.hooksPath)
sum_before=$(cksum "$work/other/.githooks/prepare-commit-msg" | cut -d' ' -f1)
run_check "$work/local" >/dev/null
[ "$(git -C "$work/local" config --get core.hooksPath)" = "$before" ] \
  || fail "the check must not modify core.hooksPath"
[ "$(cksum "$work/other/.githooks/prepare-commit-msg" | cut -d' ' -f1)" = "$sum_before" ] \
  || fail "the check must not modify any hook"

printf '%s\n' "Hook drift fixture tests passed"
