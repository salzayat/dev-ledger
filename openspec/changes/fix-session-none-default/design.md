# Design: Fix Session None Default

## Absence and declaration are different facts, and only one of them has a value

The projection already distinguishes three states for a change: it names a session that exists, it names one
that does not (`unreported`), or it names none at all (`undeclared`). `Session: none` was added as a fourth,
meaning the operator asserts there was no agent session. That assertion is useful — it is what keeps genuine
human work out of the `undeclared` gap count — and it is the only one of the four that requires someone to
know something.

The hook produces it when it knows nothing. `.githooks/prepare-commit-msg:26-27` is a two-line fallback that
turns an unset configuration variable into an assertion about who did the work. The fix is not to make the
fallback smarter; there is nothing for it to read. It is to stop writing a trailer that claims knowledge,
and let the absent trailer mean what the projection already says an absent trailer means.

That leaves `undeclared` as the default outcome for a commit made with no active session, which is the
honest classification: the repository does not know, and `openspec/specs/flow-observability/spec.md:125-134`
already requires an `undeclared` change to be counted and excluded rather than zeroed.

## The declaration has to be reachable, or it will not be made

Removing the fallback without providing a way to declare human-only work would make `none` unwritable
through the hooks, and every human-only change would land in the gap count — trading a false human-only
count for a false undeclared count.

So the declaration becomes an explicit branch-local value the operator sets, in the same place every other
trailer value already lives: `scripts/pr.sh` stores `Spec:`, effort, and `Cost-Class:` in branch
configuration and `.githooks/prepare-commit-msg` reads them back. `Session: none` joins that set instead of
being conjured by a fallback. An operator who wants the declaration states it once for the branch; an
operator who states nothing gets a gap.

## The window after a session ends is the real source of the defect

`telemetry session end` writes the record, commits it, and unsets `telemetry.session`
(`packages/capture/src/cli.ts:308-312`). That is correct — the session is over. But a branch's life usually
is not: review fixes, a rebase, a revert, and the pull request itself all land afterwards, and under the
current fallback every one of them is a positive claim of human-only work. Both non-revert instances in this
repository's history arose this way, not from a forgotten `session start`.

This is why the fix belongs in the trailer default rather than in guidance asking operators to start a
session before each commit. The gap is structural: the moment a session ends correctly, the next commit is
mislabelled automatically, and no amount of discipline about starting sessions closes it.

## The accepted requirement is amended, not worked around

`openspec/specs/telemetry-capture/spec.md:117-118` currently specifies the defaulting behaviour, so a fix
that only edited the hook would put the code in breach of the contract that describes it. The requirement is
amended so both specs define `none` the same way — a deliberate declaration of human-only work — and so the
absence of an active session is specified to produce no trailer.

The corresponding flow requirement needs no delta. `Human-only work is declared, not missing`
(`openspec/specs/flow-observability/spec.md:145-149`) is already written in terms of a declaration, and the
projection at `packages/flow/src/sessions.ts:88-92` already implements it. Only the writing side was wrong.

## History is left as it is

Five commits on the default branch carry the defaulted value, of which two are reverts and two are ordinary
follow-up commits misrecorded as human-only. Correcting them would mean rewriting published history to
change a record, which this repository's own position on records forbids: a record states what was reported
at the time. The coverage counts will carry those five until they age out of the measured window, and the
change that fixes the default does not pretend they were never written.
