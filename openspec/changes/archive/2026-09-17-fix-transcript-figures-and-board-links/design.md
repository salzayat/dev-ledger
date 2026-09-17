# Design: Fix Transcript Figures And Board Links

## Last record per message, not first

A harness that streams writes one transcript record each time a message grows, each carrying that
message's usage so far. Summing every record counts the same tokens several times; keeping the first
counts the least of each message. The right record is the last one. On this repository's own transcripts
every repeat happens to carry identical usage, so the first-wins code was right by accident of the format
and its test documented a rule that would undercount output the day the format matched the pull request's
own description. The sum now collects records into a map by identifier, so the last write wins, and records
with no identifier count once each.

## The source describes the figures the record carries

A payload is written before the sum runs, so its `figuresSource` can only describe what the harness had.
When the transcript supplied any of the three token figures, the record's source is the transcript's line
naming how many messages were summed. When the payload stated all three, nothing was filled and its own
source stands. Cost is untouched either way: a subscription session stays at zero dollars with a real
token count, as before.

## An SSH alias is not a host

`github.com-work` passed the old prefix check and became `https://github.com-work/owner/repo`, which is a
dead link on every citation. A host the derivation accepts is now `github.com` or a GitHub Enterprise host
under it whose last label is letters only, which an alias with a hyphenated suffix never is. An operator
who registers a repository by its alias names the browsable URL in the entry's `webUrl`, validated as an
https URL and written into the projection in place of the derivation. The rule that no local path reaches
the projection is unchanged: an explicit `webUrl` is an https URL or an error.

## A pipe is escaped, not forbidden

The session schema allows a pipe in a provider or model string, and a Markdown table would end the cell
at it. The body escapes the four fields it places in cells. The embedded record below the table is a code
block and needs nothing.

## Skill files say what this repository is

The two skill files arrived from the template and carried boundary text about strategy logic and
research packages that belong to a different repository. They now say the one thing that matters here: an
app, if one is ever added, renders the projection and the session records, computes no figure the projection
does not hold, loads nothing, and keys nothing to a person.
