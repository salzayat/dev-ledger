# Tasks: Fix Transcript Token Window

- [x] 1.1 ~2 `packages/capture/src/figures.ts`: window the token sum by record timestamp; `cli.ts` passes the
      session window from `session end` and `--from`/`--to` from `session figures`.
- [x] 1.2 ~1 Test: only records inside the window count; undated records are left out; no window counts all.
- [x] 2.1 ~1 Note on the page; methodology, contract, roadmap.
- [x] 2.2 ~1 `npm run check`; this pull request's own record summed with the window.
