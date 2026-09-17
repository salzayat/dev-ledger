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
| `startedAt`, `endedAt`                        | ISO 8601 timestamps                         |                                                                                                                                                         |
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
records are deduplicated by message identifier (a streaming transcript repeats a message as it grows),
`cachedTokens` is cache reads plus cache writes, and cost is never derived from a price table. A transcript
with no usage record leaves the session recorded as missing figures rather than as zeros. Every session record in the projection carries `producer: harness` and `trust: reported`.

## Trailer vocabulary (version 1)

Written by `.githooks/prepare-commit-msg` on every commit made through the hooks, validated by
`.githooks/commit-msg`, and written at the end of the pull request description by `scripts/pr.sh`.

| Trailer         | Value                                                | Single-valued per change |
| --------------- | ---------------------------------------------------- | ------------------------ |
| `Spec:`         | An identifier matching `specPattern`                 | yes                      |
| `Session:`      | A session identifier, or `none`                      | no                       |
| `Change:`       | An identifier generated once per branch              | yes                      |
| `Story-Points:` | A non-negative integer, or a value on the scale      | yes                      |
| `Work-Hours:`   | A non-negative number                                | yes                      |
| `Cost-Class:`   | A value from the cost-class vocabulary, when enabled | yes                      |

A single-valued trailer that disagrees across a change's commits is a `conflicting-trailer` gap and reads
as absent.

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
`reworkWindowDays`.

## Projection (schema version 1)

`.telemetry/projection.json`, canonical JSON (sorted keys, two-space indent, trailing newline), rebuilt by
`telemetry rebuild` and byte-identical on any machine whose mirrors hold the same ref tips. The header
names `schemaVersion`, `sessionSchemaVersion`, `registrySchemaVersion`, and `configSchemaVersion`. Each
repository carries `refTips` (the refs the mirror held), `changes`, `sessions`, `unmerged`, `releases`,
`unreleased`, `movedTags`, and `signals`, or `reachable: false` with a reason. `signals` carries the flow reads,
`dora` (deployment frequency, lead time to release with its merge-to-tag part, change failure rate, time to fix,
each with its approximation note), `trends.weekly`, `costClasses`, and `coverage`.

Each change carries its identity (the last commit on the default branch), `kind`, `commits`,
`association` (`pullRequest`, `method`: `subject`, `pull-head`, or `patch-identity`, and `classification`:
`pull-request` or `out-of-band`), `timing` (cycle and wait time in seconds or `null` with a reason),
`sessions` (declared, present, unreported, status), `releases`, `gaps`, and `producer: git`,
`trust: observed`.

`builtAt` is deliberately not a timestamp; the projection is a function of the ref tips, and a generation
time would make the same inputs hash differently.
