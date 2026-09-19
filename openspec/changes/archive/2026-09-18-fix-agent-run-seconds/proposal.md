# Fix Agent Run Seconds

## Why

Subscription spend is allocated by `agentRunSeconds`, and the Claude Code adapter never states it, so every
hook-ended session recorded zero and took no share of the plan. The transcript already holds the
timestamps; the capture read them only for operator time, and only when the window held two prompts, which
a session started after its prompt never does.

## What Changes

- `session end --transcript` fills `agentRunSeconds` from transcript timestamps when the payload omits it:
  every turn, the final one included, one prompt or none, with in-turn waits capped at the idle cap.
- Operator and autonomous time are unchanged. Records already written keep their zero; a correction record
  can restate one.
