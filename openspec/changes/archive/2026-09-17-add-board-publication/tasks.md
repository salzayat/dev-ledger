# Tasks: Add Board Publication

## 1. Fetch URL override

- [x] 1.1 Add a fetch-URL override to `packages/flow/src/sync.ts` scoped to one named registry entry,
      leaving `registry.json` unedited and the recorded ref tips unchanged.
- [x] 1.2 Surface it on `telemetry sync` in `packages/flow/src/cli.ts` and document it in the usage text
      beside the existing `sync` line.
- [x] 1.3 Keep an unreachable repository recorded as unreachable with its reason when the override fails.

## 2. The workflow

- [x] 2.1 Add `.github/workflows/board.yml` triggered on `pull_request` and on `push` to `main`, with
      `permissions: contents: read` by default.
- [x] 2.2 Check out with `fetch-depth: 0`, matching `.github/workflows/check.yml:19-21`.
- [x] 2.3 Sync this repository over its public HTTPS URL using the override and the platform-issued token,
      rebuild the projection, and render the page.
- [x] 2.4 On a pull request: upload the page as a run artifact and write the terminal render into
      `$GITHUB_STEP_SUMMARY`. Do not deploy.
- [x] 2.5 On `main`: deploy to GitHub Pages, gated on `github.event.repository.private == false`, with the
      `pages: write` and `id-token: write` permissions scoped to that job alone.
- [x] 2.6 Add a concurrency group for the deploy job that does not cancel a deployment in flight.

## 3. Documentation

- [x] 3.1 Document the published board and its URL in `README.md`, and state that it is built from the
      default branch and is public only when the repository is.
- [x] 3.2 Document the pull request surfaces (run artifact and job summary) wherever the existing checks are
      described for contributors.
- [x] 3.3 Record in the roadmap that this change depends on `add-subscription-and-operator-spend`.

## 4. Verification

- [x] 4.1 Test that a sync with the fetch-URL override records the same ref tips as a sync without it against
      the same source, so the projection is unchanged by transport.
- [x] 4.2 Test that the override applies to the named entry only and leaves other registry entries untouched.
- [x] 4.3 Verify on a pull request that the run uploads the page, writes the summary, and performs no
      deployment. Evidence (2026-09-18): run 35294292596 on pull request #20 uploaded the `board` artifact
      (17,343 bytes), wrote the terminal render to the job summary, and its `deploy` job concluded
      `skipped`.
- [x] 4.4 Verify that the deploy job is skipped while the repository is private. The repository was made
      public before the workflow first ran on `main` (run 35293653957 deployed), so the private case could
      not be observed on a live run; the gate was verified by inspection of the `if:` expression on both
      the Pages upload step and the `deploy` job, and by the pull request run above, where the same
      expression evaluated false and the job was skipped.
- [x] 4.5 Verify that no workflow in `.github/workflows/` references a repository secret for the board build,
      and that `board.yml` does not use `pull_request_target`.
- [x] 4.6 Verify that no generated page is committed: `git status` is clean after a local
      `./scripts/telemetry.sh board --html` into the workflow's output path.
- [x] 4.7 Run `npm run check`, and run the sync, rebuild, and render sequence end to end, recording the
      result in the pull request. Evidence (2026-09-18): `npm run check` passed; `sync` fetched 25 refs,
      `rebuild` printed sha256 `2551dd7362a5d5a82c31a8d9c3460590786f5207f21c1c0aa3808da8266d04a2`, and
      `board --html` wrote a 298,692 byte page.
