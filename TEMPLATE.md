# Using This Repository As A Template

This checklist is for the moment right after you fork or clone this repository to start your own
spec-driven, agent-governed project. It is a one-time setup path, in order. `CONTRIBUTING.md` covers the
ongoing change workflow you'll use afterward.

## 1. Rename the identity strings

This project's name, npm scope, and repository owner are baked into more places than a fork owner should
have to hunt down by hand: `package.json`, every `packages/*/package.json`, `tsconfig.base.json`'s custom
condition, `openspec/config.yaml`, the live OpenSpec capability directory, and several docs. Run the
rename command instead of editing them one at a time:

```bash
npm run rename -- <new-name>
```

`<new-name>` must be lowercase kebab-case (e.g. `my-project`). The command reads your current name and
owner from `package.json`, rewrites every tracked file and file/directory name that references them, and
finishes by running `npm install` to regenerate `package-lock.json` — so a broken rename fails immediately
instead of surfacing later as a confusing build error. Pass `--owner <owner>`, `--title <title>`, or
`--description <description>` to change those too; run `npm run rename -- --help` for the full option
list. The command refuses to run on a dirty git worktree and is safe to re-run.

`README.md`'s title and opening description aren't identity strings the command can infer generically —
update those by hand to describe your actual project.

## 2. Replace the teaching examples

`packages/hello` and `packages/greeter` are deterministic, dependency-linked example libraries built to
teach the repository's structure — not a foundation to build a real project on. Every tracked file meant to
be replaced or substantially adapted carries a literal `TEMPLATE:REPLACE` marker comment. Find them all:

```bash
grep -rn TEMPLATE:REPLACE packages/
```

Replace `packages/hello`'s implementation and test with your first domain capability, and either replace
`packages/greeter` with your second capability (keeping the same dependency-on-the-first pattern) or delete
it if your project doesn't need a second package yet. Update `openspec/specs/repository-foundation/spec.md`
to describe your capability's actual contract instead of `greet`/`announce`. `npm run check`'s convention
check only fails if `packages/hello`'s implementation and test disagree on whether the marker is still
present — replacing both together (removing the marker from both) passes cleanly.

## 3. Verify the workspace

```bash
npm ci
./scripts/install-git-hooks.sh
npm run check
```

`npm run check` must pass before you build anything else — it's the same gate this repository's own CI
runs, and it validates specs, harness wiring, docs freshness, secrets, formatting, types, tests, and
builds.

## 4. Propose your first domain change

Once the workspace is clean and renamed, stop editing example code directly and start using the OpenSpec
workflow this repository is built to teach. Use the `/roadmap` command (or the `roadmap-execution` skill)
to add your first real capability, or read [`docs/repository-orientation.md`](docs/repository-orientation.md)
for the full agent loop: propose, validate, implement the smallest contract-covered slice, verify, archive.

From here, [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/governance.md`](docs/governance.md) govern how
work proceeds.

## Tracking upstream template updates

To keep pulling improvements from this template after you've renamed and started your own project, add it
as a second remote:

```bash
git remote add upstream https://github.com/salzayat/dev-ledger.git
git fetch upstream
git merge upstream/main
```

Because `npm run rename` only rewrites real identity strings (no placeholder round-trip), an upstream merge
conflicts only on the specific lines the rename touched — file names and content mentioning the old
project name, npm scope, or owner. Resolve those conflicts by keeping your fork's renamed value; everything
else merges cleanly.
