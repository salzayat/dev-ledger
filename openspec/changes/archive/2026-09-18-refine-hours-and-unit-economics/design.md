# Design: Refine Hours And Unit Economics

## The window is the session

A harness may keep one transcript across many sessions. Attributing the whole file to each session
charged every record the day's hours. The session commands already own the clock, so the attribution
now keeps only events between the recorded start and the end. A payload that states its own hours keeps
them.

## Missing identifier, present hours

An operator identifier is a configuration fact; hours are a measurement. When the measurement exists and
the fact does not, dropping the hours reports less than is known. They are kept under one label that
names the gap, `(no operator identifier)`, and the command prints how to close it.

## Two columns per unit

Reported cost and allocated cost are different trust classes and never sum, so every unit-economics figure
carries both, each labeled. On a subscription the reported column reads zero and the allocated column
carries the number; on a metered plan the reverse. Tasks and their complexity join the units because they
are the estimate the repository already makes.
