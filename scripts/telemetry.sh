#!/bin/sh
# Entry point for the capture and flow tooling. Runs the flow package's command line against this
# working copy: session, subscription, validate, validate-message, sync, rebuild, cursor, ledger, hash.
set -eu

# The tool is wherever this script lives; the repository acted on is the one the command runs in. That is
# what lets capture run from any repository once install-capture.sh has put its hooks there.
tool_root=$(cd "$(dirname "$0")/.." && pwd)
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if [ ! -d "$tool_root/node_modules" ]; then
  printf '%s\n' "node_modules is missing in $tool_root; run npm ci there first" >&2
  exit 1
fi

case "${1:-}" in
  session | subscription | timesheet | note | class | validate | validate-message)
    exec node --conditions=@dev-ledger/source --experimental-strip-types \
      "$tool_root/packages/capture/src/cli.ts" "$@"
    ;;
  *)
    if [ ! -f "$tool_root/packages/flow/src/cli.ts" ]; then
      printf '%s\n' "The flow package is not present in this checkout; only session, validate, and validate-message are available." >&2
      exit 1
    fi
    exec node --conditions=@dev-ledger/source --experimental-strip-types \
      "$tool_root/packages/flow/src/cli.ts" "$@"
    ;;
esac
