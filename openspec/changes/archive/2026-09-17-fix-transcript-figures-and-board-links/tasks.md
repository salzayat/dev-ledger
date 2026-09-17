# Tasks: Fix Transcript Figures And Board Links

## Capture

- [x] 1.1 `packages/capture/src/figures.ts`: keep the last usage record per message identifier; records
      without an identifier count once each.
- [x] 1.2 `packages/capture/src/cli.ts`: `session end --transcript` sets `figuresSource` to the transcript's
      when the transcript supplied any figure; escape pipes in the four table cells of the session summary.
- [x] 1.3 Tests: last record wins for a repeated message; a stale payload source is replaced and a stated
      source is kept; a pipe in a model string renders as one cell.

## Flow

- [x] 2.1 `packages/flow/src/registry.ts`: `webUrl` derives only for `github.com` or a GitHub Enterprise host
      ending in a plain top-level label; an entry may name `webUrl` explicitly (https only, else an error).
- [x] 2.2 `packages/flow/src/projection.ts`: the explicit `webUrl` takes precedence over the derivation.
- [x] 2.3 Tests: an SSH alias derives null; an explicit `webUrl` is recorded, trailing slash trimmed; a
      non-https `webUrl` is a registry error.

## Harness and documentation

- [x] 3.1 `.agent/skills/next-best-practices/SKILL.md` and `.agent/skills/react-best-practices/SKILL.md`:
      boundary text for this repository.
- [x] 3.2 `docs/contract.md`: last record per identifier; the `webUrl` registry field. `docs/methodology.md`:
      the link target may come from the entry. `plans/roadmap.md`: this row.

## Verification

- [x] 4.1 `npm run check` passes (2026-09-17, on this branch, and again through the pre-commit hook).
- [x] 4.2 End to end: this branch's own session record is produced by `session end --transcript` over the
      agent's transcript and carries summed figures with the transcript's source; `rebuild` over a registry
      entry using the `github.com-work` alias with an explicit `webUrl` renders linked citations.
      Evidence (2026-09-17): a registry of two entries both using the `github.com-work` alias synced over
      SSH; the entry with `webUrl` recorded `https://github.com/salzayat/dev-ledger` and the bare entry
      recorded null; the rendered page carried 775 linked commit citations and no `github.com-work` link.
      This branch's session record was written by `session end --transcript` over the agent's transcript.
