#!/bin/sh
set -eu

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

[ -f docs/dependency-patterns.md ] || fail "Missing dependency pattern documentation"
[ -f plans/roadmap.md ] || fail "Missing roadmap"
[ -f packages/capture/src/index.ts ] || fail "Missing capture package implementation"
[ -f packages/capture/src/capture.test.ts ] || fail "Missing capture package test"
[ -f telemetry.config.json ] || fail "Missing telemetry.config.json"
[ -x scripts/telemetry.sh ] || fail "Missing executable scripts/telemetry.sh"
for hook in prepare-commit-msg commit-msg pre-commit pre-push; do
  [ -x ".githooks/$hook" ] || fail "Missing executable .githooks/$hook"
done

grep -q '^## OpenSpec Dependencies$' docs/dependency-patterns.md \
  || fail "Dependency documentation must define the OpenSpec dependency convention"

# The template's example packages were replaced by capture; no TEMPLATE:REPLACE marker may remain.
if grep -rq 'TEMPLATE:REPLACE' packages/; then
  fail "A TEMPLATE:REPLACE marker remains under packages/; the template examples were replaced"
fi

printf '%s\n' "Repository convention check passed"
