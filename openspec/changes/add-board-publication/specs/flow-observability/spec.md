# flow-observability Specification Delta

## MODIFIED Requirements

### Requirement: A registry of repositories synced over SSH

The system SHALL keep a version-controlled registry (`registry.json`) listing each repository with a name,
its SSH URL, its default branch, its release tag pattern, and its signal thresholds. `telemetry sync` SHALL
fetch each registered repository into a local mirror, including tags and `refs/pull/*/head`, using the
operator's own git access and nothing else, and SHALL record the ref tips it fetched. A repository that
cannot be fetched SHALL be recorded as unreachable with the reason, and every read covering it SHALL name
it as unreachable rather than omitting it silently. A sync MAY be given a fetch URL overriding that of one
named registry entry, for an environment that reaches the same repository over a different transport; the
override SHALL apply to that entry alone, SHALL NOT modify `registry.json`, and SHALL NOT change the ref
tips recorded, so a projection rebuilt from an overridden sync is identical to one rebuilt from a sync
without it against the same source.

#### Scenario: Sync fetches pull head refs

- GIVEN a registered repository on a host that advertises pull head refs
- WHEN `telemetry sync` runs
- THEN the local mirror MUST contain every advertised `refs/pull/*/head` and every tag

#### Scenario: An unreachable repository is named

- GIVEN a registry of four repositories of which one refuses the operator's SSH key
- WHEN `telemetry sync` runs and the projection is rebuilt
- THEN the projection MUST record that repository as unreachable with the reason
- AND every aggregate read MUST name it

#### Scenario: Sync needs no platform credential

- GIVEN a working copy with no platform API token configured
- WHEN `telemetry sync` runs
- THEN it MUST complete using git over SSH alone

#### Scenario: An overridden fetch URL changes the transport and nothing else

- GIVEN a registry entry whose URL is an SSH remote, and a sync given an HTTPS fetch URL for that entry
- WHEN `telemetry sync` runs and the projection is rebuilt
- THEN the recorded ref tips MUST equal those recorded by a sync without the override against the same source
- AND `registry.json` MUST be unchanged
- AND no other registry entry MUST be fetched from an overridden URL
