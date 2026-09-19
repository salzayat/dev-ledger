# Add Spec Cost Classes

## Why

Every session on the page reads `unclassified`, because a cost class is declared per session or per commit
trailer and nobody sets either. The R&D against production question, the one finance and resource planning
ask first, has no answer. And the cost-class panel shows reported spend only, which is $0.00 on a
subscription, so even a classified session would show nothing that matters.

## What Changes

- A committed declaration per spec, `.telemetry/classes.json`, written by `telemetry class set <spec>
<class>` and validated against the configured vocabulary. Every change and session citing that spec
  inherits the class. Resolution order: the session's own class, the change's trailer, the spec's
  declaration, else `unclassified`. Still a declaration, never a default.
- The cost-class panel carries allocated spend and operator hours per class beside reported spend, and
  says how each record's class was resolved.
- Flow efficiency reports the active time outside any change's window by spec, so the thinking time has
  an address.
- The change-drafting skill asks for a `~N` weight on each task line.
- This repository declares every spec `rd`.

## Dependencies

`refine-hours-and-unit-economics` (archived).

## Non-Goals

- No default class per repository or by branch pattern. A class is declared by a person, per spec.
