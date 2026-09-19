# Design: Add Capture Install

## Shims, not a hooks path

Pointing another repository's `core.hooksPath` at this checkout would replace its own hooks. A shim in its
`.git/hooks` runs that repository's existing hook first, if one was kept, then this checkout's hook. The two
hooks installed read nothing but git configuration and the repository's own `.telemetry/`, so they work
anywhere. A repository with `core.hooksPath` set is left alone; the installer prints what to add.

## The tool is where the script is

Every command resolves the tool root from its own path and works on the repository of the current directory,
so `<ledger>/scripts/telemetry.sh session start` from any repository records there.
