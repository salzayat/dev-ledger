# Tasks: Add Board Publication

## 1. Fetch URL override

- [ ] 1.1 Add a fetch-URL override to `packages/flow/src/sync.ts` scoped to one named registry entry,
      leaving `registry.json` unedited and the recorded ref tips unchanged.
- [ ] 1.2 Surface it on `telemetry sync` in `packages/flow/src/cli.ts` and document it in the usage text
      beside the existing `sync` line.
- [ ] 1.3 Keep an unreachable repository recorded as unreachable with its reason when the override fails.

## 2. The workflow

- [ ] 2.1 Add `.github/workflows/board.yml` triggered on `pull_request` and on `push` to `main`, with
      `permissions: contents: read` by default.
- [ ] 2.2 Check out with `fetch-depth: 0`, matching `.github/workflows/check.yml:19-21`.
- [ ] 2.3 Sync this repository over its public HTTPS URL using the override and the platform-issued token,
      rebuild the projection, and render the page.
- [ ] 2.4 On a pull request: upload the page as a run artifact and write the terminal render into
      `$GITHUB_STEP_SUMMARY`. Do not deploy.
- [ ] 2.5 On `main`: deploy to GitHub Pages, gated on `github.event.repository.private == false`, with the
      `pages: write` and `id-token: write` permissions scoped to that job alone.
- [ ] 2.6 Add a concurrency group for the deploy job that does not cancel a deployment in flight.

## 3. Documentation

- [ ] 3.1 Document the published board and its URL in `README.md`, and state that it is built from the
      default branch and is public only when the repository is.
- [ ] 3.2 Document the pull request surfaces (run artifact and job summary) wherever the existing checks are
      described for contributors.
- [ ] 3.3 Record in the roadmap that this change depends on `add-subscription-and-operator-spend`.

## 4. Verification

- [ ] 4.1 Test that a sync with the fetch-URL override records the same ref tips as a sync without it against
      the same source, so the projection is unchanged by transport.
- [ ] 4.2 Test that the override applies to the named entry only and leaves other registry entries untouched.
- [ ] 4.3 Verify on a pull request that the run uploads the page, writes the summary, and performs no
      deployment.
- [ ] 4.4 Verify that the deploy job is skipped while the repository is private, by observing the skipped job
      on a `main` run before visibility changes.
- [ ] 4.5 Verify that no workflow in `.github/workflows/` references a repository secret for the board build,
      and that `board.yml` does not use `pull_request_target`.
- [ ] 4.6 Verify that no generated page is committed: `git status` is clean after a local
      `./scripts/telemetry.sh board --html` into the workflow's output path.
- [ ] 4.7 Run `npm run check`, and run the sync, rebuild, and render sequence end to end, recording the
      result in the pull request.
