# Tasks: Add Local Configuration Surface

## 1. The published artifact stays clean

- [ ] 1.1 Assert in `packages/flow/src/board-html.ts` output that no editing markup is emitted: no `<form>`,
      no `<script>`, no control that would write.
- [ ] 1.2 Strengthen the existing self-contained test to cover forms and editing controls, not only scripts
      and external resources.
- [ ] 1.3 Keep the editing surface's markup in its own module, so it cannot be reached from the published
      renderer by accident.

## 2. The local server

- [ ] 2.1 Add a command that serves the configuration surface against the working copy.
- [ ] 2.2 Bind to the loopback interface only, and refuse to start when asked to bind anything else.
- [ ] 2.3 Serve the same gaps the Board's configuration panel names, from the same projection read.
- [ ] 2.4 Print the URL and the path it is editing, so it is obvious which working copy is in play.

## 3. Editing

- [ ] 3.1 Edit plan declarations: add a plan, append an interval, correct an interval that has not been
      closed against.
- [ ] 3.2 Edit subscription cost records for a period, with the same validation the command applies.
- [ ] 3.3 Reject any write outside the declaration and subscription record paths.
- [ ] 3.4 Write to the working copy and never commit, never stage, and never run any git operation.
- [ ] 3.5 Show the resulting diff, or the paths written, so the operator can review before committing.

## 4. Documentation

- [ ] 4.1 Document the command in `README.md`, stating that it is local-only and optional.
- [ ] 4.2 State in `docs/methodology.md` why the published page carries no editor and the local one does.

## 5. Verification

- [ ] 5.1 Test that the page written by `telemetry board --html` contains no form, no script, and no editing
      control.
- [ ] 5.2 Test that the server refuses to bind a non-loopback address.
- [ ] 5.3 Test that a write outside the declaration and record paths is refused.
- [ ] 5.4 Test that editing writes the working copy and leaves the index and history untouched.
- [ ] 5.5 Test that a projection rebuilt after an edit is identical to one rebuilt from the same files
      written by the command, so the surface is an editor and not a second source of truth.
- [ ] 5.6 Run `npm run check` and the board end to end, recording the result in the pull request.
