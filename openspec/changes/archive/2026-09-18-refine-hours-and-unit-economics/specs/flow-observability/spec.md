# flow-observability Specification Delta

## ADDED Requirements

### Requirement: Unit economics carry an allocated figure beside the reported one

Every cost-per figure (per unit of effort, per merged change, per released change, per release) SHALL
report an allocated amount in the allocation's currency beside the reported cost, never summing the two.
The effort units SHALL include `tasks` and `taskComplexity`, taken from the tasks each change completed
with an unweighted task counting one. Operator hours recorded without an identifier SHALL be reported
under one label naming the missing identifier rather than excluded. The Ledger SHALL lead its summary
strip with allocated spend, SHALL label reported spend as reported, SHALL write "provisional" in words,
and SHALL show allocated and reported per unit side by side.

#### Scenario: Cost per complexity point on a subscription

- GIVEN a change that completed tasks of complexity 3 and 5 and took a $16 allocated share, with reported
  cost fixed at zero
- WHEN cost per unit of effort is computed
- THEN `taskComplexity` MUST read $2 allocated per unit
- AND its reported figure MUST read zero, not be summed into the allocated one

#### Scenario: Hours without an identifier stay visible

- GIVEN a session record carrying operator hours and a null operator identifier
- WHEN the operator dimension is computed
- THEN those hours MUST appear under a label naming the missing identifier
