# Design: Add Operator Dimension

## Operators are symmetric in what is tracked and asymmetric in unit

The accepted contract admits provider and model as dimensions while excluding the human operator, so the
agent side of a change is measurable and the human side is not. This change makes the dimension cover both.

The units stay different on purpose. An agent's consumption of a paid plan is denominated in the currency
the plan is billed in, through the allocation `add-subscription-spend` computes. A human's effort is
denominated in hours, from `operatorActiveSeconds` under its idle cap, and is never multiplied by a rate;
the rejection of `hourlyRate`, `rate`, `salary`, and `compensation` in the record schema is what keeps the
record incapable of expressing one, and it is not relaxed here. The two figures render beside each other
and are never summed, because a sum would require exactly the rate the schema refuses to hold.

## Where the privacy property lives

Pseudonymity is enforced by `isPseudonymousId` in the capture configuration and by the forbidden-key
rejection above, both of which survive this change untouched. The Board-level prohibition this change
removes was doing something different from those guards: it was withholding a measurement, not protecting
an identity. That is the argument for the change. The argument against it is the published one: a tool for
finding your own bottleneck stops being that the moment it can be turned around on the team. The
repository owner decides which argument wins; this design records both.

## Human-only changes have hours that no record holds

`Session: none` declares that a change was human-only work. Such a change has human hours by definition
and no session file to carry them, because `operatorActiveSeconds` is computed by a harness hook from that
harness's own events. This change does not invent a figure for them: they are excluded from the
human-hours figure with their count stated, so a reader sees that the hours shown cover agent-assisted work
only.

## Enabling allocation is forward-only

`telemetry.config.json` carries `costAllocation.enabled: false`, and no existing record carries
`operatorId` or `operatorActiveSeconds`. The figure is computed from live harness events, so there is
nothing to reconstruct from. The human-operator dimension starts empty and fills from the first session
recorded after the flag is enabled, and its excluded count states how much of the corpus predates it.
