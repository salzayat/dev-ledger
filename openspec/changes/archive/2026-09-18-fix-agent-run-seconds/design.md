# Design: Fix Agent Run Seconds

Run time is measured record to record inside a turn rather than prompt to prompt, so the operator's reading
time between turns is never charged to the agent, and the last turn, which has no next prompt, still counts.
A gap inside a turn longer than the idle cap is a wait on a person, a permission prompt or a question, so it
counts as the cap, the same bound operator time uses. A window whose first record is the agent's is work
already under way when `session start` ran, which is how the adapter's sessions begin, so the run starts at
that record. On this repository's own transcript, three sessions that recorded zero read 788, 219, and 125
seconds against wall clocks of 790, 295, and 196.
