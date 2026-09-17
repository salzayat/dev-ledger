# flow-observability Specification Delta

## MODIFIED Requirements

### Requirement: A registry of repositories synced over SSH

The system SHALL keep a version-controlled registry (`registry.json`) listing each repository with a name,
its SSH URL, its default branch, its release tag pattern, its signal thresholds, and optionally an explicit
browsable web URL, which SHALL be an https URL or a registry error. `telemetry sync` SHALL fetch each
registered repository into a local mirror, including tags and `refs/pull/*/head`, using the operator's own
git access and nothing else, and SHALL record the ref tips it fetched. A repository that cannot be fetched
SHALL be recorded as unreachable with the reason, and every read covering it SHALL name it as unreachable
rather than omitting it silently.

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

#### Scenario: An explicit web URL must be browsable

- GIVEN a registry entry whose `webUrl` is a `file:` URL
- WHEN the registry is parsed
- THEN the entry MUST be reported as an error naming the field

### Requirement: Projection rebuilt from history

The system SHALL materialize a projection by walking each registered repository's default branch in
topological order and reading commit messages and trailers, session files, tags, and pull head refs. The
projection SHALL be written as canonical JSON with sorted keys and a schema version, SHALL record the ref
tips it was built from, and SHALL be byte-identical on any machine whose mirrors hold the same ref tips.
It SHALL order events by the commit graph and never by author timestamp, and SHALL be deletable and
rebuildable with no loss. The projection SHALL record, per repository, the registry entry's explicit web
URL when one is given, otherwise the web URL derived from its remote when that remote is `github.com` or a
GitHub Enterprise host, and SHALL record no local filesystem path. A remote whose host is an SSH alias SHALL
derive no web URL.

#### Scenario: Two machines rebuild identically

- GIVEN two machines whose mirrors hold the same ref tips for every registered repository
- WHEN each runs the rebuild
- THEN both projections MUST be byte-identical

#### Scenario: A rebased timestamp does not reorder events

- GIVEN a merge commit whose author timestamp is earlier than its parent's
- WHEN the projection is rebuilt
- THEN the event order MUST follow the commit graph

#### Scenario: Deleting the projection loses nothing

- GIVEN a materialized projection
- WHEN it is deleted and rebuilt from the same mirrors
- THEN the rebuilt projection MUST be byte-identical to the deleted one

#### Scenario: A local registry URL records no path

- GIVEN a registry entry whose URL is a local filesystem path
- WHEN the projection is rebuilt
- THEN the repository's web URL MUST be null
- AND the projection MUST NOT contain that path

#### Scenario: An SSH alias derives no link, and the entry may supply one

- GIVEN a registry entry whose URL is `git@github.com-work:owner/repo.git`
- WHEN the projection is rebuilt without an explicit `webUrl`
- THEN the repository's web URL MUST be null
- AND WHEN the entry names `webUrl` as `https://github.com/owner/repo`
- THEN the projection MUST record that URL
