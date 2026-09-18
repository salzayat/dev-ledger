#!/bin/sh
# Build The Ledger from scratch and show it: mirror-fetch every registered repository, rebuild the
# projection, write the dashboard, and open it. Everything runs against the working copy and the local
# mirrors; `sync` is the only step that reaches the network, and it uses the operator's own git access.
set -eu

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

open_page=true
page=".telemetry/ledger.html"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-open) open_page=false ;;
    --output)
      shift
      [ "$#" -gt 0 ] || { printf '%s\n' "--output requires a path" >&2; exit 1; }
      page=$1
      ;;
    -h | --help)
      printf '%s\n' "usage: ./scripts/ledger.sh [--no-open] [--output PATH]"
      exit 0
      ;;
    *)
      printf '%s\n' "unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

./scripts/telemetry.sh sync
./scripts/telemetry.sh rebuild
./scripts/telemetry.sh ledger --html "$page"

[ "$open_page" = true ] || exit 0

# No opener is an inconvenience, not a failure: the path is already printed above.
if command -v open >/dev/null 2>&1; then
  open "$page"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$page"
else
  printf '%s\n' "no opener found; open $page yourself" >&2
fi
