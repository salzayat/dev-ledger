#!/bin/sh
# Installs dev-ledger capture into another repository, so its sessions, spend, and hours are recorded.
#
#   ./scripts/install-capture.sh <repository> [--operator <id>] [--plan <id>] [--provider <name>]
#                                              [--claude] [--force]
#
# Writes two hook shims (prepare-commit-msg adds the trailers, pre-push stops a finished record being left
# behind) into the repository's own git hooks, sets the operator, plan, and provider in its local git
# configuration, writes a telemetry.config.json if it has none, and with --claude wires Claude Code's
# session hooks to this checkout's adapter. It never touches the repository's commit style or checks.
set -eu

die() {
  printf '%s\n' "$1" >&2
  exit 1
}

tool_root=$(cd "$(dirname "$0")/.." && pwd)
[ "$#" -ge 1 ] || die "usage: install-capture.sh <repository> [--operator <id>] [--plan <id>] [--provider <name>] [--claude] [--force]"
target=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || die "$1 is not a git repository"
shift
operator='' plan='' provider='' claude=false force=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --operator) operator=${2:?--operator needs an id}; shift ;;
    --plan) plan=${2:?--plan needs an id}; shift ;;
    --provider) provider=${2:?--provider needs a name}; shift ;;
    --claude) claude=true ;;
    --force) force=true ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

# A repository that routes its hooks elsewhere (husky and friends) gets instructions, not edits.
if hooks_path=$(git -C "$target" config --get core.hooksPath); then
  printf '%s\n' "$target sets core.hooksPath=$hooks_path, so git ignores .git/hooks there." >&2
  printf '%s\n' "Add these lines to the hooks in $hooks_path instead:" >&2
  printf '  prepare-commit-msg:  "%s/.githooks/prepare-commit-msg" "$@"\n' "$tool_root" >&2
  printf '  pre-push:            "%s/.githooks/pre-push" "$@"\n' "$tool_root" >&2
  exit 1
fi

hooks_dir="$(git -C "$target" rev-parse --absolute-git-dir)/hooks"
mkdir -p "$hooks_dir"
for name in prepare-commit-msg pre-push; do
  hook="$hooks_dir/$name"
  if [ -f "$hook" ] && ! grep -q 'dev-ledger capture shim' "$hook"; then
    if [ "$force" != true ]; then
      printf '%s\n' "kept the existing $name hook; rerun with --force to keep it as $name.local and run it first" >&2
      continue
    fi
    mv "$hook" "$hook.local"
  fi
  cat >"$hook" <<SHIM
#!/bin/sh
# dev-ledger capture shim, installed by $tool_root/scripts/install-capture.sh
here=\$(dirname "\$0")
if [ -x "\$here/$name.local" ]; then "\$here/$name.local" "\$@" || exit \$?; fi
exec "$tool_root/.githooks/$name" "\$@"
SHIM
  chmod +x "$hook"
  printf '%s\n' "hook: $hook"
done

[ -n "$operator" ] && git -C "$target" config telemetry.operator "$operator"
[ -n "$plan" ] && git -C "$target" config telemetry.plan "$plan"
[ -n "$provider" ] && git -C "$target" config telemetry.provider "$provider"

config="$target/telemetry.config.json"
if [ ! -f "$config" ]; then
  operators='[]'
  [ -n "$operator" ] && operators="[\"$operator\"]"
  cat >"$config" <<CONFIG
{
  "schemaVersion": 1,
  "costAllocation": {
    "enabled": true,
    "idleCapSeconds": 900,
    "operators": $operators,
    "costClasses": ["rd", "production"]
  }
}
CONFIG
  printf '%s\n' "wrote $config: commit it so every clone records hours the same way"
elif [ -n "$operator" ] && ! grep -q "\"$operator\"" "$config"; then
  printf '%s\n' "warning: $operator is not declared in $config; add it to costAllocation.operators" >&2
fi

if [ "$claude" = true ]; then
  settings="$target/.claude/settings.json"
  command="$tool_root/scripts/harness/claude-code.sh"
  if [ -f "$settings" ]; then
    printf '%s\n' "$settings exists; add \"$command\" as a command hook on SessionStart and SessionEnd" >&2
  else
    mkdir -p "$target/.claude"
    cat >"$settings" <<SETTINGS
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "$command" }] }],
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "$command" }] }]
  }
}
SETTINGS
    printf '%s\n' "wrote $settings: Claude Code sessions in $target now record themselves"
  fi
fi

printf '%s\n' "capture installed in $target"
