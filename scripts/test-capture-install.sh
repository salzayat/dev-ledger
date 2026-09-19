#!/bin/sh
# Capture installed into another repository: shims, configuration, a session recorded through its own
# hooks, an existing hook kept, and a repository with core.hooksPath refused.
set -eu
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_COMMON_DIR \
  GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_CEILING_DIRECTORIES GIT_NAMESPACE GIT_CONFIG_PARAMETERS || true

tool_root=$(cd "$(dirname "$0")/.." && pwd)
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
fail() {
  printf '%s\n' "capture install: $1" >&2
  exit 1
}
fixture() {
  git init --quiet --initial-branch=main "$1"
  git -C "$1" config user.email contributor@example.com
  git -C "$1" config user.name Contributor
  git -C "$1" commit --quiet --allow-empty -m "chore(init): seed"
}

repo="$scratch/app"
fixture "$repo"
"$tool_root/scripts/install-capture.sh" "$repo" --operator op-1 --plan plan-max --provider provider-a --claude >/dev/null
for name in prepare-commit-msg pre-push; do
  grep -q 'dev-ledger capture shim' "$repo/.git/hooks/$name" || fail "no $name shim"
done
grep -q '"op-1"' "$repo/telemetry.config.json" || fail "config does not declare the operator"
[ "$(git -C "$repo" config --get telemetry.plan)" = plan-max ] || fail "plan not set"
grep -q "$tool_root/scripts/harness/claude-code.sh" "$repo/.claude/settings.json" || fail "adapter not wired"

cd "$repo"
git add telemetry.config.json .claude && git commit --quiet -m "chore(ledger): install capture"
git switch --quiet -c work
"$tool_root/scripts/telemetry.sh" session start --id s-fixture >/dev/null
printf 'x\n' >work.txt && git add work.txt && git commit --quiet -m "feat(app): work"
git log -1 --format=%B | grep -q '^Session: s-fixture$' || fail "the work commit carries no Session trailer"
printf '%s' '{"sessionId":"s-fixture","provider":"provider-a","model":"model-x","figuresSource":"fixture","billingKind":"subscription","subscriptionId":"plan-max","branch":"work","commits":[],"localCheck":{"outcome":"not-run","command":"none"}}' |
  "$tool_root/scripts/telemetry.sh" session end --payload - >/dev/null
record=$(git ls-files .telemetry/sessions)
[ -n "$record" ] || fail "the session record was not committed in the repository"
grep -q '"operatorId": "op-1"' "$record" || fail "the record does not carry the operator"
git log -1 --format=%B | grep -q '^Session: s-fixture$' || fail "the record commit carries no Session trailer"

kept="$scratch/kept"
fixture "$kept"
printf '#!/bin/sh\ntouch "%s/ran"\n' "$scratch" >"$kept/.git/hooks/pre-push" && chmod +x "$kept/.git/hooks/pre-push"
"$tool_root/scripts/install-capture.sh" "$kept" 2>/dev/null >/dev/null
grep -q 'dev-ledger capture shim' "$kept/.git/hooks/pre-push" && fail "an existing hook was replaced without --force"
"$tool_root/scripts/install-capture.sh" "$kept" --force >/dev/null
[ -x "$kept/.git/hooks/pre-push.local" ] || fail "--force did not keep the existing hook"
(cd "$kept" && .git/hooks/pre-push origin url </dev/null) || fail "the shim failed"
[ -f "$scratch/ran" ] || fail "the kept hook did not run first"

routed="$scratch/routed"
fixture "$routed"
git -C "$routed" config core.hooksPath .husky
if "$tool_root/scripts/install-capture.sh" "$routed" >/dev/null 2>&1; then
  fail "a repository with core.hooksPath was edited instead of refused"
fi

printf '%s\n' "Capture install tests passed"
