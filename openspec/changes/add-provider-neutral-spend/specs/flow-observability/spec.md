# flow-observability Specification Delta

## ADDED Requirements

### Requirement: Metered spend is reported per token beside the allocated rate

The projection SHALL report, per provider and per currency, the reported cost of metered sessions divided by
their input and output tokens, carrying trust class `reported`. It SHALL be rendered beside the allocated
rate and SHALL NOT be summed with it, since one is a measured cost and the other a consequence of an
allocation basis. Metered sessions reporting no tokens SHALL be counted and that count stated. A denominator
SHALL NOT be combined across providers, because the token counts providers report are not the same
measurement. A rate whose denominator is zero SHALL be reported as not computable rather than as zero.

#### Scenario: A metered rate is reported, not allocated

- GIVEN metered sessions reporting a cost and their tokens
- WHEN the rate is computed
- THEN it MUST divide the reported cost by input plus output tokens
- AND it MUST carry trust class `reported`
- AND it MUST NOT be summed with the allocated rate

#### Scenario: Two providers never share a denominator

- GIVEN metered sessions from two providers
- WHEN the rates are computed
- THEN each provider's rate MUST be reported separately
- AND no denominator MUST combine the two providers' tokens
