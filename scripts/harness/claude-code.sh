#!/bin/sh
# Claude Code hook adapter: runs the session lifecycle so nobody has to remember it. Wire it in
# .claude/settings.json under SessionStart and SessionEnd. Reads the hook's JSON from stdin
# (hook_event_name, session_id, transcript_path) and needs nothing but git and this repository.
set -eu

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"
[ -d node_modules ] || exit 0

input=$(cat)
field() {
  printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s)[process.argv[1]];process.stdout.write(v==null?"":String(v))})' "$1"
}
event=$(field hook_event_name)
session=$(field session_id)
transcript=$(field transcript_path)
id="s-$(date -u +%Y%m%d)-$(printf '%s' "$session" | cut -c1-8)"

case "$event" in
  SessionStart)
    ./scripts/telemetry.sh session start --id "$id" >/dev/null
    ;;
  SessionEnd)
    active=$(git config --get telemetry.session 2>/dev/null || true)
    [ -n "$active" ] || exit 0
    # Everything else the record needs is derivable: the model from the transcript, the plan from the
    # declarations, the commits from the branch since the session started, the branch from git.
    started=$(git config --get telemetry.session-started 2>/dev/null || true)
    branch=$(git branch --show-current)
    commits=$(git log --format=%H --since="$started" --grep="^Session: $active" 2>/dev/null | tr '\n' ' ')
    plan=$(node -e 'try{const p=require("./.telemetry/subscriptions/plans.json").plans[0];process.stdout.write(p?p.planId:"")}catch{}')
    provider=$(node -e 'try{const p=require("./.telemetry/subscriptions/plans.json").plans[0];process.stdout.write(p?p.provider:"")}catch{}')
    model=$(node --conditions=@dev-ledger/source --experimental-strip-types \
      "$repo_root/packages/capture/src/cli.ts" session figures --transcript "$transcript" --model-only 2>/dev/null || true)
    billing=subscription
    [ -n "$plan" ] || billing=metered
    node -e '
      const [active, provider, model, branch, commits, billing, plan] = process.argv.slice(1);
      const payload = {
        sessionId: active, provider: provider || "unknown", model: model || "unknown",
        figuresSource: "claude-code hook; figures summed from the transcript",
        billingKind: billing, ...(plan ? { subscriptionId: plan, costUsd: 0 } : {}),
        branch, commits: commits.trim() ? commits.trim().split(/\s+/) : [],
        localCheck: { outcome: "not-run", command: "npm run check" },
      };
      process.stdout.write(JSON.stringify(payload));
    ' "$active" "$provider" "$model" "$branch" "$commits" "$billing" "$plan" |
      ./scripts/telemetry.sh session end --payload - --transcript "$transcript" >/dev/null || {
        printf '%s\n' "telemetry: session end failed; the session stays active, run ./scripts/telemetry.sh session end by hand" >&2
      }
    ;;
esac
