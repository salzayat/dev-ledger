#!/bin/sh
# Splices a generated block into a pull request body without rewriting any supplied line.
#
#   merge-pr-body.sh <body-file> <block-file>
#
# The block is printed inside the body's "## Data / generated output" section when it has one, and as its
# own section at the end otherwise. Every supplied line is reproduced byte-for-byte, in order.
set -eu

[ "$#" -eq 2 ] || {
  printf '%s\n' 'usage: merge-pr-body.sh <body-file> <block-file>' >&2
  exit 1
}
body_file=$1
block_file=$2
[ -r "$body_file" ] || {
  printf '%s\n' "PR body file is not readable: $body_file" >&2
  exit 1
}
[ -r "$block_file" ] || {
  printf '%s\n' "block file is not readable: $block_file" >&2
  exit 1
}

awk -v block="$block_file" '
  function emit_block(   line) {
    print "<!-- telemetry:begin -->"
    print ""
    while ((getline line < block) > 0) { print line }
    close(block)
    print "<!-- telemetry:end -->"
    emitted = 1
  }
  /^## / {
    if (in_data && !emitted) { emit_block(); print "" }
    in_data = ($0 == "## Data / generated output")
  }
  { print }
  END {
    if (emitted) { exit }
    if (in_data) { print ""; emit_block(); exit }
    print ""
    print "## Data / generated output"
    print ""
    emit_block()
  }
' "$body_file"
