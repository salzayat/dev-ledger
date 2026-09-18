# Tasks: Add Operator Hours From Transcript

## 1. Operator events from a transcript

- [x] 1.1 Add operator-prompt extraction to `packages/capture/src/figures.ts`: a `type: "user"` record whose
      content is a string, or whose content blocks are all `text`, contributes its timestamp.
- [x] 1.2 Exclude any record carrying a `tool_result` block, and any record with no parsable timestamp.
- [x] 1.3 Compute the figure with the existing `computeOperatorActiveSeconds` and the configured idle cap,
      and report the algorithm identifier and the prompt count alongside it.

## 2. The command and the record

- [x] 2.1 Emit `operatorActiveSeconds` and `operatorActiveAlgorithm` from
      `telemetry session figures --transcript`, beside the token figures.
- [x] 2.2 Fill them in `telemetry session end --transcript` when the payload left them out, leaving a
      payload that states them alone.
- [x] 2.3 Set `operatorId` from the configured operator as `session end` already does, unchanged.

## 3. Validation

- [x] 3.1 Stop failing a record that carries no operator figures when cost allocation is enabled; a record
      carrying neither field is valid and its absence is counted by the reads.
- [x] 3.2 Keep rejecting a present-but-malformed figure: a negative `operatorActiveSeconds`, or an
      `operatorActiveAlgorithm` that is not a string.
- [x] 3.3 Keep rejecting operator fields when cost allocation is disabled, unchanged.

## 4. Documentation

- [x] 4.1 Document the derivation in `docs/contract.md` and `docs/methodology.md`: which records count, the
      idle cap, and that only timestamps are read.
- [x] 4.2 Update `README.md` where the transcript command is described.

## 5. Verification

- [x] 5.1 Test that a transcript of human prompts and tool results counts only the prompts, over a fixture
      whose `tool_result` records outnumber the prompts.
- [x] 5.2 Test that a gap longer than the idle cap contributes the cap, and that a single prompt yields zero.
- [x] 5.3 Test that a record with no operator figures validates when cost allocation is enabled, and that a
      negative figure still fails.
- [x] 5.4 Test that no transcript content other than timestamps reaches the session record.
- [x] 5.5 Run `./scripts/telemetry.sh validate` over the committed corpus and confirm it reports no error.
- [x] 5.6 Run `npm run check` and record the result in the pull request.
