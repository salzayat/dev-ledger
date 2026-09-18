#!/bin/sh
# Entry point for the capture and flow tooling. Runs the flow package's command line against this
# working copy: session, subscription, validate, validate-message, sync, rebuild, cursor, ledger, hash.
set -eu

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if [ ! -d node_modules ]; then
  printf '%s\n' "node_modules is missing; run npm ci first" >&2
  exit 1
fi

case "${1:-}" in
  session | subscription | validate | validate-message)
    exec node --conditions=@dev-ledger/source --experimental-strip-types \
      "$repo_root/packages/capture/src/cli.ts" "$@"
    ;;
  *)
    if [ ! -f "$repo_root/packages/flow/src/cli.ts" ]; then
      printf '%s\n' "The flow package is not present in this checkout; only session, validate, and validate-message are available." >&2
      exit 1
    fi
    exec node --conditions=@dev-ledger/source --experimental-strip-types \
      "$repo_root/packages/flow/src/cli.ts" "$@"
    ;;
esac
