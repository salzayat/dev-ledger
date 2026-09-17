# Add Telemetry In Pull Request Body

## Why

A pull request opened by `scripts/pr.sh` says nothing about the session records it carries. The generated
body's last section is a comment placeholder — `## Data / reports` with
`<!-- Note if this PR changes data, reports, or experiment outputs, and where. -->`
(`scripts/pr.sh:270`) — so a reviewer reading the description cannot see what the branch recorded, what the
harness supplied, or whether any of it is missing, without checking out the branch and opening the files.
The records are the repository's product; a pull request that hides them is the wrong default.

Two smaller defects sit in the same lines:

- The generated body's heading is `## Data / reports`, while the repository's own template
  (`.github/pull_request_template.md`) heads that section `## Data / generated output`. A contributor
  filling in the template and an agent running the script produce differently-shaped descriptions.
- The `Spec:`, `Session:`, and `Story-Points:` trailers are appended only when no body file was given
  (`scripts/pr.sh:290`). The comment above that line explains that the trailers exist so the merge message
  carries them onto the squash commit — which means every pull request opened with `--body-file`, the path
  the repository's own agent command uses, loses them.

## What Changes

- `capture` gains `session summary [--base <ref>] [--head <ref>]`, which prints a Markdown section
  describing every session record added between two refs: a table of record path, session identifier,
  provider and model, its figures or the reason there are none, and its local check outcome, followed by
  each record's full JSON. It reads git and the session files only, so `capture` keeps needing nothing but
  git and itself.
- `scripts/pr.sh` puts that section into the pull request body — inside `## Data / generated output` when
  the body has that heading, and as its own section at the end otherwise — for a generated body and for a
  `--body-file` body alike. The supplied text is never altered; the block is appended within the section,
  delimited by an HTML comment marker naming it as generated.
- The trailer block is appended for a `--body-file` body too, so a pull request opened by the agent command
  carries `Spec:` and `Session:` onto the merge commit like any other.
- The generated body's headings match `.github/pull_request_template.md`.

## Dependencies

None. The section is built from session files and git, not from the projection, so it needs nothing from
the per-pull-request spend work that lands in the flow package.

## Non-Goals

- No projection read and no dependency on the `flow` package. `capture` stands alone by design, and the
  pull request does not exist yet when its body is built, so per-pull-request projection figures cannot be
  in it.
- No editing of the contributor's supplied body text. The block is appended, never interleaved, and never
  replaces a line the contributor wrote.
- No network call and no platform API read beyond the `gh pr create` the script already makes.
- No figure the records do not carry. A record with missing figures is named as missing, never rendered as
  zero.
- No person in the section. Provider, model, session identifier, and check outcome only.
