# workflow-governance Specification Delta

## MODIFIED Requirements

### Requirement: A pull request body records the branch's session telemetry

The PR automation MUST include, in every pull request body it creates, a generated section naming every
session record added on the branch relative to the base: the record's path, its session identifier, its
provider and model, its figures, and its local check outcome, followed by each record's content. A record
whose harness supplied no figures MUST be named as missing figures and MUST NOT be rendered as a zero cost
or a zero token count. When the branch adds no session record, the section MUST say so explicitly rather
than being omitted or left empty. The section MUST be placed inside the body's data section when the body
has one, and MUST be built from the session files and git alone, never from the projection. A field placed
in a table cell MUST be escaped so that a pipe in its value cannot end the cell.

#### Scenario: A branch with a recorded session

- GIVEN a branch carrying one session record with figures and one carrying `figuresMissing`
- WHEN the PR helper opens the pull request
- THEN the description MUST name both records with their session identifiers and check outcomes
- AND the second MUST read as missing figures rather than as zero cost

#### Scenario: A branch with no session record

- GIVEN a branch that adds no session file
- WHEN the PR helper opens the pull request
- THEN the description MUST state explicitly that the branch recorded no session

#### Scenario: A pipe in a model name stays in its cell

- GIVEN a session record whose model string contains a pipe
- WHEN the section is generated
- THEN the row MUST keep its five cells with the pipe escaped
