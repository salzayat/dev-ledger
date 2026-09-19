# Design: Remove Zero Figures

The accepted rule for missing figures is that they are counted, never read as zero. The page kept that rule
for records and broke it for panels: a subscription repository's reported cost is fixed at zero by the
contract, and printing `$0.00` in eleven places presented that constraint as a measurement. The render now
distinguishes three things and says which: a reported figure, an absence ("none reported", "none confirmed
yet"), and a measured zero ("none" escapes). Nothing in the projection changes.
