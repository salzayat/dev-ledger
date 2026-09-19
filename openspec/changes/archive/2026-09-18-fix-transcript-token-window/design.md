# Design: Fix Transcript Token Window

The session commands already own the clock, and hours are already filtered to it. The token sum takes the
same window and filters on each record's top-level timestamp. Without a window it counts everything, so a
transcript kept per session reads as before. Records written earlier stay as reported, and the note says
which figures they inflate: tokens and the per-million-token rate, not allocated dollars.
