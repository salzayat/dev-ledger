# flow-observability Specification Delta

## ADDED Requirements

### Requirement: The operator dimension covers agents and humans alike

The projection and The Board SHALL offer the operator as a dimension, covering agent operators identified by
provider and model and human operators identified by the pseudonymous `operatorId`. Agent effort SHALL be
reported in the currency of the subscription allocation and in tokens where reported; human effort SHALL be
reported in hours derived from `operatorActiveSeconds`. No read and no rendered figure SHALL multiply a
human operator's hours by any rate, express a human operator's effort in currency, or sum a figure in hours
with a figure in currency. No read SHALL resolve an `operatorId` to a name or an email address. A change
whose commits carry `Session: none`, and a session recorded before operator capture was enabled, SHALL be
excluded from the human-hours figure with their counts stated, and SHALL NOT be counted as zero hours.

#### Scenario: Agent and human effort are reported in their own units

- GIVEN a change with a session carrying both `agentRunSeconds` and `operatorActiveSeconds`
- WHEN the operator dimension is requested
- THEN the agent figure MUST be in currency and tokens
- AND the human figure MUST be in hours
- AND no figure MUST combine the two units

#### Scenario: Human effort is never priced

- GIVEN a projection whose session records carry `operatorActiveSeconds`
- WHEN any read or rendered page is produced
- THEN none MUST multiply those seconds by a rate
- AND none MUST express a human operator's effort as a currency amount

#### Scenario: Human-only work is excluded from hours, not zeroed

- GIVEN a change whose commits carry `Session: none`
- WHEN human hours are requested
- THEN that change MUST be reported in the excluded count
- AND it MUST NOT be counted as zero hours

#### Scenario: An operator identifier is never resolved to a person

- GIVEN a projection whose session records carry pseudonymous operator identifiers
- WHEN the operator dimension is rendered
- THEN no name or email address MUST appear
- AND each human operator MUST be identified by its pseudonymous identifier alone
