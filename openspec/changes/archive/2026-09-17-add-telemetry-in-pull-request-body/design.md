# Design: Add Telemetry In Pull Request Body

## The section is built by `capture`, not by the shell

`scripts/pr.sh` is POSIX shell and already carries the repository's sharpest correctness rule: every
interpolated value must be literal text unconditionally (`openspec/specs/workflow-governance/spec.md`,
Requirement: PR automation preserves literal body content). Formatting a Markdown table and embedded JSON
from arbitrary session files in shell would put that rule under pressure for no reason — a record's
`figuresSource` is free text written by a harness.

So the section comes from `packages/capture/src/cli.ts`, which already reads and validates session files
(`session end`), and the script only splices the finished block. The command reads git and the session
files and nothing else, which keeps the package's stated boundary: "It needs nothing but git and this
package, so a repository can record sessions before the flow package exists"
(`packages/capture/src/cli.ts:13-14`).

## The block is appended inside the section, never interleaved

The literal-body rule exists because a previous defect expanded body text as shell. Appending is the only
edit that cannot corrupt the contributor's text: the script finds the `## Data / generated output` heading,
appends the block immediately before the next `## ` heading (or at the end of the body when that section is
last), and adds the section itself when the heading is absent. No supplied line is rewritten, and the block
is wrapped in `<!-- telemetry:begin -->` / `<!-- telemetry:end -->` so a reader — and a later run — can see
exactly which text the script produced.

`awk` does the splice against the body file, rather than shell string interpolation, so neither the body nor
the block passes through a shell expansion.

## Missing figures are named, not zeroed

The table's figures column reads from the record: `1,000 in · 200 out · 100 cached · $0.50` when the
harness supplied figures, and `figures missing` when the record carries `figuresMissing`
(`packages/capture/src/session.ts:254-258` decides which). This is the same rule the projection applies
(`packages/flow/src/signals.ts`), stated once more at the point a human reads it, because a `$0.00` in a
pull request description is exactly as misleading as one on The Board.

Each record's full JSON follows the table inside a `<details>` block: the table is for scanning, the JSON
is the record as committed, and a reviewer should never have to trust a summary of a file the pull request
also contains.

## Trailers apply to a body file too

`scripts/pr.sh:290` appends the trailer block only when no body file was given. The comment directly above
it says the trailers are there so the merge message carries them onto the squash commit, which is a
property of the pull request, not of how its description was authored. The condition is dropped; the
trailers are appended to whichever body is being used, after the telemetry block.
