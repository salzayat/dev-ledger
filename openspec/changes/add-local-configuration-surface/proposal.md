# Add Local Configuration Surface

## Why

`add-subscription-declarations` gives The Board a configuration panel that names every gap and the command
that closes it, and stops there: the published page reads only from the projection, carries no script
element and no external resource, and opens from a `file:` URL
(`openspec/specs/flow-observability/spec.md:410`, `:413`). A static file on a hosting surface has nothing for
a form to submit to.

That constraint is right for the published page and wrong as a limit on the tool. An operator running this
repository on their own machine has a working copy, a shell, and every permission the commands already use;
for them, reading a gap and then retyping a command in another window is friction with no safety behind it.
The two audiences are different, and one artifact has been carrying both.

## What Changes

- Add a local configuration surface, served by its own command against the working copy, that edits plan
  declarations and subscription cost records and shows the same gaps the panel names.
- Produce it as a separate artifact from a separate command. The page written by `telemetry board --html`
  SHALL contain no editing markup at all — not hidden markup, not disabled controls, not a script that
  chooses at runtime — so the published deployment cannot be made to reveal an editor it never carried.
- Bind the server to the loopback interface only, and refuse to serve on any other, so a local surface stays
  local.
- Write to the working copy and never commit, as `telemetry subscription close` already does, leaving the
  commit as the moment a person confirms.
- Keep it optional: nothing in the projection, the reads, the published board, or continuous integration
  depends on it, and the mechanism works exactly as it does today when it is never run.

## Dependencies

`add-subscription-declarations` (active), which defines the declarations this edits and the gaps it shows.
It is selected after that change is archived.

## Non-Goals

- No change to the published artifact. `telemetry board --html` writes the same self-contained, script-free,
  form-free page it writes today, and the requirement that it does is strengthened rather than relaxed.
- No hosted service. The server runs on an operator's own machine, on loopback, for as long as they run it;
  `openspec/specs/flow-observability/spec.md:524` stays true because nothing requires it.
- No authority the commands do not already have. It edits the same two file kinds
  `telemetry subscription record` and the declaration already write, in the same working copy.
- No commit, no push, no git operation of any kind from the surface.
- No editing of session records, the projection, or anything the harness produced. Configuration is
  operator-entered; records of what happened are not editable from a web page.
