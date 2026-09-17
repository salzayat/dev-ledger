# Fix Transcript Figures And Board Links

## Why

A review of the four pull requests that built session figures and the Board's links found five defects
that the next work would build on. A transcript's repeated message kept its first usage record, which is
the one that saw the least of the message. A record filled from a transcript kept a `figuresSource` written
before the sum, so real token counts sat under a sentence saying the harness had none. A registry URL with
an SSH host alias (`git@github.com-work:owner/repo.git`) derived a web URL under a host that does not
exist, so every citation on the Board pointed at a dead link. A pipe in a session field would end a table
cell in the pull request body. And two skill files merged with a pull request about something else carried
another project's boundary text.

## What Changes

- `sumTranscriptUsage` keeps the last usage record per message identifier. A streaming record carries
  the message's cumulative usage, so the last one saw the whole message.
- `session end --transcript` sets `figuresSource` to the transcript's whenever the transcript supplied any
  figure; a payload that stated all three figures keeps its own source.
- `webUrl` derives a link only for `github.com` and a GitHub Enterprise host ending in a plain top-level
  label. A registry entry may name `webUrl` explicitly, for a remote whose host is an SSH alias.
- The pull request body escapes a pipe in a session identifier, provider, model, or check outcome.
- The Next.js and React skill files describe this repository's boundary: an app may render the projection
  and may not compute a figure it does not hold.

## Dependencies

None.

## Non-Goals

- No price table, no derived cost. `cachedTokens` stays cache reads plus cache writes, as the contract
  says; a future cost-per-token read would need them split, and that is a schema change of its own.
- No Next.js app. The skill files are corrected, not exercised.
