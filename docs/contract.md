# The Capture And Projection Contract

Four things in this repository are contracts a consumer can pin, and each carries a version. Phase two
(`add-change-audit`) reads them; anything else that reads the projection should too. A change to any of
them bumps its version.

## Session file (schema version 1)

Written by the harness hook at session end to `.telemetry/sessions/<yyyy-mm>/<session-id>.json`, committed
as its own commit on the work branch, and never edited afterwards (a correction is a further file naming
the one it corrects in `corrects`). The path is marked `linguist-generated`.

| Field                                         | Type                                        | Notes                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                               | `1`                                         |                                                                                                                                                         |
| `sessionId`                                   | string                                      | Matches the `Session:` trailer on the session's commits                                                                                                 |
| `provider`, `model`                           | string                                      | Data fields; the only place a provider or model name appears                                                                                            |
| `inputTokens`, `outputTokens`, `cachedTokens` | non-negative integer                        |                                                                                                                                                         |
| `costUsd`                                     | non-negative number                         | Must be `0` for a subscription session                                                                                                                  |
| `notionalCostUsd`                             | non-negative number, optional               | A pay-per-token equivalent; no total reads it                                                                                                           |
| `figuresSource`                               | string                                      | Where the harness got the figures                                                                                                                       |
| `figuresMissing`                              | `true`, optional                            | Present when the harness could not supply token or cost figures; the session's zeros never enter a spend total and the change counts as missing figures |
| `startedAt`, `endedAt`                        | ISO 8601 timestamps                         | A payload may omit them: `session start` records the start clock and `session end` supplies the end                                                     |
| `wallClockSeconds`                            | non-negative number                         | Derived from start and end                                                                                                                              |
| `agentRunSeconds`                             | non-negative number                         | Time the agent was executing                                                                                                                            |
| `billingKind`                                 | `metered` or `subscription`                 |                                                                                                                                                         |
| `subscriptionId`                              | string, required for `subscription`         |                                                                                                                                                         |
| `branch`, `commits`                           | string, string[]                            |                                                                                                                                                         |
| `spec`                                        | string, optional                            | Must match the configured `specPattern`                                                                                                                 |
| `localCheck`                                  | `{ outcome, command }`                      | `passed`, `failed`, or `not-run`                                                                                                                        |
| `costClass`                                   | string, optional                            | Only when cost allocation is enabled; from the configured vocabulary                                                                                    |
| `operatorActiveSeconds`                       | number, only with cost allocation           | Under the idle-capped algorithm named in `operatorActiveAlgorithm`                                                                                      |
| `operatorId`                                  | string or `null`, only with cost allocation | A declared pseudonymous identifier; `null` when missing                                                                                                 |
| `corrects`                                    | string, optional                            | The session this file corrects                                                                                                                          |

A file carrying `name`, `operatorName`, `email`, `hourlyRate`, `rate`, `salary`, or `compensation` is
rejected.

Figures reach a record in one of two ways, both `reported`: the harness states them in the payload, or
`session end --transcript <file>` sums them from a local transcript — a JSONL file whose records carry a
`usage` object in the wire format of the model API. A transcript fills only the figures the payload omits,
and when it filled any, `figuresSource` names the transcript and the number of messages summed. Records
are deduplicated by message identifier and the last record for an identifier wins (a streaming transcript
repeats a message as it grows, each record carrying its usage so far), `cachedTokens` is cache reads plus
cache writes, and cost is never derived from a price table.

The same transcript gives the operator's hours. A human prompt is a user-addressed record whose content is a
string or whose blocks are all text; a record carrying a tool result is the harness returning its own output
to the model and is not an operator event, so an unattended agent turn does not read as someone sitting
there. The span between consecutive prompts is then split three ways rather than
capped whole. Up to the last agent record in that span the agent was producing on its own; after it the
person was reading, thinking, and typing; and beyond the idle cap the thread was simply left open. So a
session spanning 1.37 hours with a long agent run in the middle records 0.42 hours of man time, 0.95
autonomous, and no idle — where capping the whole span would have recorded 1.28 hours of man time and
charged the agent's work to the person. Across this repository's own transcripts that difference is about
1.75 times. Fewer than two prompts leaves the figure absent rather than zero, and nothing but timestamps is
read. A transcript with no usage record leaves the
session recorded as missing figures rather than as zeros. Every session record in the projection carries `producer: harness` and `trust: reported`.

## Subscription cost record (schema version 1)

Written by `telemetry subscription record` to `.telemetry/subscriptions/<yyyy-mm>/<plan>.json` and
committed. A subscription session records no marginal cost (`costUsd` stays `0`), so what the plan cost is
a fact of the period, entered by the operator and never fetched from a provider.

| Field           | Type                | Notes                                                  |
| --------------- | ------------------- | ------------------------------------------------------ |
| `schemaVersion` | `1`                 |                                                        |
| `planId`        | string              | Matches the `subscriptionId` of the sessions it covers |
| `period`        | `YYYY-MM`           | The billing period                                     |
| `amount`        | non-negative number | What the plan cost for the period                      |
| `currency`      | three-letter code   | Upper case                                             |
| `overageAmount` | non-negative number | Paid beyond the plan in the period; `0` when none      |

The record rejects the same forbidden keys a session file does. The projection apportions `amount` and
`overageAmount` across the sessions that end in the period on that plan, in proportion to
`agentRunSeconds`; a session with no agent seconds takes no share and is counted. Every apportioned figure
carries the trust class `allocated` (the record itself is `reported` with producer `operator`), names its
basis, and is provisional while the period has not closed as of the newest commit the mirror holds.

## Note (schema version 1)

`.telemetry/notes/<id>.json`, written by `telemetry note add`: `schemaVersion`, `noteId`, `figure` (one word
naming a read), optional `period` (`YYYY-MM`), `text` (at most 600 characters), `at` (ISO 8601). Rejects the
session record's forbidden keys. Rendered on the records tab, dated and cited.

## Trailer vocabulary (version 1)

Written by `.githooks/prepare-commit-msg` on every commit made through the hooks, validated by
`.githooks/commit-msg`, and written at the end of the pull request description by `scripts/pr.sh`.

| Trailer         | Value                                                | Single-valued per change |
| --------------- | ---------------------------------------------------- | ------------------------ |
| `Spec:`         | An identifier matching `specPattern`                 | yes                      |
| `Session:`      | A session identifier, or `none` when declared        | no                       |
| `Change:`       | An identifier generated once per branch              | yes                      |
| `Story-Points:` | A non-negative integer, or a value on the scale      | yes                      |
| `Work-Hours:`   | A non-negative number                                | yes                      |
| `Cost-Class:`   | A value from the cost-class vocabulary, when enabled | yes                      |

A single-valued trailer that disagrees across a change's commits is a `conflicting-trailer` gap and reads
as absent.

`Session:` is written only when the repository knows the answer. An active session writes its identifier. A
branch an operator has declared human-only, with `telemetry session human-only`, writes `none`. With
neither — before a session starts, and after `session end` unsets it — no `Session:` trailer is written at
all, and the change reads `undeclared`. The distinction matters because `none` is a claim that a person
worked without an agent, and a missing trailer is the absence of a claim; defaulting one to the other turned
an unset variable into an assertion about who did the work.

### Session record fields added for provider neutrality

| Field              | Type   | Meaning                                                                            |
| ------------------ | ------ | ---------------------------------------------------------------------------------- |
| `cost`             | object | `{ amount, currency }` for a provider not billing in USD; `costUsd` is read as USD |
| `cacheReadTokens`  | number | Cache reads, when the harness reports them apart from writes                       |
| `cacheWriteTokens` | number | Cache writes; absent means unknown, never zero                                     |

A record carrying both `cost` in USD and a different `costUsd` is rejected. `cachedTokens` remains the
combined figure every committed record carries, and a read including a record with no components says so.

## Plan declarations (schema version 1)

Committed to `.telemetry/subscriptions/plans.json`, listing what each plan is arranged to cost.

| Field       | Type   | Meaning                                                                                               |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `planId`    | string | Matches the `subscriptionId` of the sessions it covers                                                |
| `provider`  | string | The provider billing the plan                                                                         |
| `currency`  | string | ISO 4217 code, upper case                                                                             |
| `intervals` | list   | `{ from, unit, seats }`, ordered, non-overlapping, each holding from its period until the next begins |

A price or seat change appends an interval; it never rewrites one, so what a plan cost in any period stays
readable. A period covered by no interval is reported as uncovered rather than resolving to the nearest. The
same forbidden keys a session record rejects apply here: no name, email address, or rate.

`./scripts/telemetry.sh subscription close <YYYY-MM>` writes one cost record per declared plan for that
period, with `amount` as seats times unit. It leaves an existing record alone unless `--overwrite` is passed,
refuses a period whose end has not passed unless `--force` is passed, and **does not commit**: it prints the
paths it wrote, and an operator reviews the diff and commits.

### Registry keys added for flow efficiency and work mix

| Key                                | Meaning                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `thresholds.abandonedAfterSeconds` | The age past which an unmerged pull head is reported as older than it  |
| `rework.ignore`                    | Globs whose files never make a rework pair; replaces the default list  |
| `measuredFrom`                     | ISO 8601 instant; changes merged before it are excluded by reason      |
| `closedPullRequests`               | Pull request numbers an operator declares closed; they leave the queue |

## Registry (schema version 1)

`registry.json` at the repository root.

```json
{
  "schemaVersion": 1,
  "repositories": [
    {
      "name": "dev-ledger",
      "url": "git@github.com:salzayat/dev-ledger.git",
      "defaultBranch": "main",
      "releaseTagPattern": "v*",
      "thresholds": { "waitTimeP50Seconds": 172800, "reworkWindowDays": 14 }
    }
  ]
}
```

Thresholds: `waitTimeP50Seconds`, `cycleTimeP50Seconds`, `queueAgeSeconds`, `batchSizeLines`,
`reworkWindowDays`. An optional `webUrl` (https only) names the browsable repository when the remote's host
is an SSH alias the derivation cannot read; it is recorded in the projection in place of the derived URL.

## Projection (schema version 1)

`.telemetry/projection.json`, canonical JSON (sorted keys, two-space indent, trailing newline), rebuilt by
`telemetry rebuild` and byte-identical on any machine whose mirrors hold the same ref tips. The header
names `schemaVersion`, `sessionSchemaVersion`, `registrySchemaVersion`, and `configSchemaVersion`. Each
repository carries `refTips` (the refs the mirror held), `changes`, `sessions`, `subscriptions`, `unmerged`,
`releases`, `unreleased`, `movedTags`, and `signals`, or `reachable: false` with a reason. `signals` carries
the flow reads, `dora` (deployment frequency, lead time to release with its merge-to-tag part, change failure
rate, time to fix, each with its approximation note), `trends.weekly`, `costClasses`, `coverage`, and
`allocation` (the subscription periods, each session's share, aggregates per currency, and the excluded
counts, all under trust `allocated` with basis `agentRunSeconds`).

Each change carries its identity (the last commit on the default branch), `kind`, `commits`,
`association` (`pullRequest`, `method`: `subject`, `pull-head`, or `patch-identity`, and `classification`:
`pull-request` or `out-of-band`), `timing` (cycle and wait time in seconds or `null` with a reason),
`sessions` (declared, present, unreported, status), `releases`, `gaps`, and `producer: git`,
`trust: observed`.

`builtAt` is deliberately not a timestamp; the projection is a function of the ref tips, and a generation
time would make the same inputs hash differently.
