#!/bin/sh
# Fixture tests for the pull request body splice: supplied text survives byte-for-byte, and the generated
# block lands in the data section when there is one.
set -eu

temporary_root=$(mktemp -d)
trap 'rm -rf "$temporary_root"' EXIT

block="$temporary_root/block.md"
printf '%s\n' '### Session records on this branch' '' 'This branch adds no session record.' > "$block"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

# A body whose text includes backticks, shell-looking text, and a data section.
body="$temporary_root/body.md"
cat > "$body" <<'BODY'
## Summary

- `add-thing` uses $(echo not-executed) and `rm -rf /` as literal text

## Data / generated output

No generated artifact is committed.

## Skipped checks

None.
BODY
merged="$temporary_root/merged.md"
./scripts/merge-pr-body.sh "$body" "$block" > "$merged"

# Every supplied line must appear in the merged body, in order and unchanged. `grep -e` keeps a line
# beginning with a dash from being read as an option.
while IFS= read -r line; do
  grep -Fxq -e "$line" "$merged" || fail "Supplied line was not preserved: $line"
done < "$body"
supplied_only=$(grep -Fxv -e '<!-- telemetry:begin -->' -e '<!-- telemetry:end -->' "$merged" |
  grep -Fxv -f "$block" || true)
printf '%s\n' "$supplied_only" | grep -Fq 'No generated artifact is committed.' ||
  fail 'The data section lost its supplied text' 

grep -Fq '$(echo not-executed)' "$merged" || fail 'Body text was expanded rather than passed literally'
grep -Fxq '<!-- telemetry:begin -->' "$merged" || fail 'Telemetry block marker is missing'
grep -Fxq '<!-- telemetry:end -->' "$merged" || fail 'Telemetry block end marker is missing'

data_line=$(grep -n '^## Data / generated output$' "$merged" | cut -d: -f1)
skipped_line=$(grep -n '^## Skipped checks$' "$merged" | cut -d: -f1)
begin_line=$(grep -n '^<!-- telemetry:begin -->$' "$merged" | cut -d: -f1)
[ "$begin_line" -gt "$data_line" ] || fail 'Block was not placed inside the data section'
[ "$begin_line" -lt "$skipped_line" ] || fail 'Block escaped the data section'
[ "$(grep -c '^## Data / generated output$' "$merged")" -eq 1 ] || fail 'The data section was duplicated'

# A body with no data section gets one appended at the end.
plain="$temporary_root/plain.md"
printf '%s\n' '## Summary' '' '- something' > "$plain"
plain_merged="$temporary_root/plain-merged.md"
./scripts/merge-pr-body.sh "$plain" "$block" > "$plain_merged"
grep -Fxq '## Data / generated output' "$plain_merged" || fail 'Missing appended data section'
summary_line=$(grep -n '^## Summary$' "$plain_merged" | cut -d: -f1)
appended_line=$(grep -n '^## Data / generated output$' "$plain_merged" | cut -d: -f1)
[ "$appended_line" -gt "$summary_line" ] || fail 'Section was not appended at the end'

printf '%s\n' 'Pull request body fixture tests passed'
