# Tasks: Fix Capture Git Environment

## 1. Capture

- [x] 1.1 The git helper in `packages/capture/src/cli.ts` sets `GIT_TERMINAL_PROMPT=0` and `LC_ALL=C` and
      removes every inherited git variable before running a child.

## 2. Verification

- [x] 2.1 Test: with `GIT_INDEX_FILE` and `GIT_DIR` set to nonexistent paths, a capture command against a
      fixture repository still reads that repository.
- [x] 2.2 `npm run check` passes, including the pre-commit hook path where those variables are exported.
      Evidence (2026-09-17): the defect was first seen as a failed `telemetry session end` commit
      (`error: invalid object 100644 2d50ee5f… for '.telemetry/sessions/2026-09/s-blind.json'`); with the
      guard in place the same command commits the record, and the hook path runs the suite clean.
