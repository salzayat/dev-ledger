# Design: Add Release Cost Class

Release membership is observed: a change is released when a release tag's history contains it, which the
projection already computes. A class that follows it moves when a tag is cut, so work that is R&D today
becomes production on the day it ships, and the projection stays a function of the refs. Explicit
declarations keep winning, so a spec can still be marked either way whatever its release state.
