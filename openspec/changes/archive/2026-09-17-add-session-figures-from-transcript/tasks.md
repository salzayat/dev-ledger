# Tasks: Add Session Figures From Transcript

## 1. Capture

- [x] 1.1 `packages/capture/src/figures.ts`: `sumTranscriptUsage(text)` returning input, output, and cached
      token totals plus the number of messages counted, deduplicating by message identifier and ignoring a
      line that is not JSON or carries no `usage`.
- [x] 1.2 `session figures --transcript <file>` prints the figures and the source line as JSON.
- [x] 1.3 `session end --transcript <file>` fills only the figure fields the payload omits, and leaves a
      record with no usage record in the transcript as missing figures.

## 2. Documentation

- [x] 2.1 `docs/contract.md` and `docs/methodology.md` describe where figures come from and that cost is
      never derived.
- [x] 2.2 README key commands include `session figures`.
- [x] 2.3 `plans/roadmap.md`: this change as a telemetry-capture addendum.

## 3. Verification

- [x] 3.1 Test: a transcript repeating one message's usage across several records counts it once.
- [x] 3.2 Test: cached tokens are cache reads plus cache writes; input excludes both.
- [x] 3.3 Test: a transcript with no usage record, an unreadable line, or an empty file yields no figures,
      and the session file is written as missing figures rather than as zeros.
- [x] 3.4 Test: a payload that states its own figures is not overwritten by a transcript.
- [x] 3.5 `npm run check` passes (2026-09-17, on this branch).
- [x] 3.6 End to end: record this session with `--transcript` and confirm the record carries real token
      figures and no `figuresMissing`; record the result in the PR.
