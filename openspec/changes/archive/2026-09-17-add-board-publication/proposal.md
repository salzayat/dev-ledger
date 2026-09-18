# Add Board Publication

## Why

The Board's static HTML render exists and is reachable only by opening a local file. `telemetry board --html`
writes one self-contained page (`packages/flow/src/board-html.ts`), and nothing publishes it, so the one read
surface this repository builds is visible to whoever ran the command and to nobody else. The repository is
private today and becomes public after the first release; `v0.1.0` is already tagged and pushed
(`0493710c978b072e798be87ef1fcc7ed0ef197aa`) with no release cut yet, so the surface that should demonstrate
the tool is unreachable at the moment the tool is first shown to anyone.

Publishing it from continuous integration is not a matter of adding a step. The Board reads the projection,
the projection is rebuilt from local mirrors, and `telemetry board --html` run without a mirror writes an
empty board. Building one in CI therefore requires `telemetry sync`, which fetches `registry.json`'s SSH URL
(`git@github.com:salzayat/dev-ledger.git`) using the operator's own git access
(`packages/flow/src/sync.ts:28-43`) with no URL override anywhere in `packages/flow`. Wiring that up as it
stands means putting a private key into a workflow, which `Sync needs no platform credential`
(`openspec/specs/flow-observability/spec.md:36`) and the repository's own credential boundary both refuse.

## What Changes

- Allow a registry entry's fetch URL to be overridden for one sync, so continuous integration can mirror this
  repository over its public HTTPS URL with the token the platform already provides, and add no secret.
- Add a workflow that builds The Board on every pull request, uploads the page as a run artifact, and writes
  the terminal render into the run's job summary, without deploying anything.
- Deploy the page to GitHub Pages from the default branch only, gated on the repository being public, so the
  workflow can land while the repository is private and begin publishing when it is not.
- Serialize deployments with a concurrency group, since a repository has one Pages site and a merge queue can
  otherwise race it.
- Publish what the records currently say: every currency figure on the page renders `$0.00`
  (`packages/capture/src/session.ts:132-137`) until a subscription cost record exists, and the page says
  so beside the figure rather than waiting for it.

## Dependencies

`add-subscription-and-operator-spend` was named here as a dependency so a published page would not lead with
a spend panel reading `$0.00`. That was a judgement about presentation, not a technical requirement, and the
repository owner has decided to publish ahead of it: the board publishes what the records currently say, and
the currency figures become real when that change lands. It is no longer a dependency of this one.

`add-flow-efficiency-and-work-mix` (active, `Pending`), which modifies `A registry of repositories synced
over SSH` as this change does. Both deltas rewrite the same requirement, so whichever archives second is
rebased onto the first.

## Non-Goals

- No generated page committed to the tree. Nothing under `.telemetry/` gains a `board.html`, and no branch
  holds a built site.
- No deployment from a pull request. The workflow uses `pull_request`, never `pull_request_target`, and its
  deploy job does not run for a pull request event.
- No secret added to any workflow. The only credential used is the platform-issued `GITHUB_TOKEN`.
- No sync of any registry entry other than this repository in continuous integration. The override applies to
  one named entry, and third-party entries stay operator-local.
- No change to what The Board renders. Its content, layout, trust classes, and citations are the subject of
  `add-subscription-and-operator-spend`.
- No change to `Capture needs no credential and no network`
  (`openspec/specs/telemetry-capture/spec.md:177`); capture is not involved in publication.
