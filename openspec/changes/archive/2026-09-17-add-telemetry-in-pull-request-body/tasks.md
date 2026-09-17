# Tasks: Add Telemetry In Pull Request Body

## 1. Capture

- [x] 1.1 `session summary [--base <ref>] [--head <ref>]` in `packages/capture/src/cli.ts`: the session
      records added between the refs, as a Markdown table (record, session, provider and model, figures or
      the reason there are none, check outcome) followed by each record's JSON in a `<details>` block.
- [x] 1.2 The command prints an explicit "no session record on this branch" line rather than an empty
      section, and exits 0 either way.
- [x] 1.3 A record carrying `figuresMissing` reads `figures missing`; a record with figures reads its
      tokens and cost. No record is rendered as `$0.00` unless its own `costUsd` is zero and its figures
      are present.

## 2. PR automation

- [x] 2.1 `scripts/pr.sh` splices the section into `## Data / generated output` when the body has that
      heading, and appends the section otherwise, for a generated body and a `--body-file` body alike,
      delimited by `<!-- telemetry:begin -->` and `<!-- telemetry:end -->`.
- [x] 2.2 The trailer block is appended for a `--body-file` body too.
- [x] 2.3 The generated body's headings match `.github/pull_request_template.md`.

## 3. Documentation

- [x] 3.1 `docs/governance.md` (or the PR workflow section it points to) and `CONTRIBUTING.md` describe the
      generated telemetry section and that a contributor's body text is never rewritten.
- [x] 3.2 `plans/roadmap.md`: this change as a workflow-governance addendum.

## 4. Verification

- [x] 4.1 Test: `session summary` over a fixture repository with one record carrying figures and one
      carrying none renders both rows, names the missing one, and embeds both records' JSON.
- [x] 4.2 Test: `session summary` with no session record between the refs prints the explicit empty line.
- [x] 4.3 Test: a body file containing backticks, shell-looking text, and a `## Data / generated output`
      heading keeps every supplied line byte-for-byte, with the block spliced inside that section.
- [x] 4.4 Test: a body with no such heading gets the section appended at the end.
- [x] 4.5 `npm run check` passes (2026-09-17, on this branch).
- [x] 4.6 End to end: open this change's own pull request with `scripts/pr.sh` and confirm the description
      carries the section and the trailers; record the result in the PR. Evidence is in that description:
      the section it generated for itself, between the markers, inside the data section.
