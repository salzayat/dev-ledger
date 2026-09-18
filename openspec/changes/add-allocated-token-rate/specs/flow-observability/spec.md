# flow-observability Specification Delta

## ADDED Requirements

### Requirement: The allocated amount is reported per token

The projection SHALL report, per currency, the allocated subscription amount divided by the input and output
tokens of the sessions that took a share of it, and SHALL report the same amount divided by those sessions'
cache reads as a separate figure. Input and output SHALL be the headline denominator and cache reads SHALL
NOT be added to it. A session that took a share and reported no tokens SHALL be counted and that count
stated, so a rate computed over fewer records than it covers says so rather than reading low. A rate whose
denominator is zero SHALL be reported as not computable rather than as zero. The rate SHALL carry the trust
class `allocated`, SHALL cite the records behind it, and SHALL be marked provisional whenever any share
behind it came from a period that has not closed. No read SHALL present the rate as a price, and no figure
SHALL be derived from a price table.

#### Scenario: Cache reads stay out of the headline denominator

- GIVEN an allocated period whose sessions report 1,000,000 input and output tokens and 100,000,000 cache
  reads
- WHEN the rate is computed
- THEN the headline rate MUST divide the amount by the 1,000,000 input and output tokens
- AND the cache-read rate MUST be reported separately
- AND the two MUST NOT be combined into one denominator

#### Scenario: A session reporting no tokens is counted, not dropped

- GIVEN an allocated period of three sessions of which one carries `figuresMissing`
- WHEN the rate is computed
- THEN the denominator MUST be the tokens of the two that reported them
- AND the figure MUST state that one session reported none

#### Scenario: No tokens yields no rate

- GIVEN an allocated period in which no session that took a share reported tokens
- WHEN the rate is computed
- THEN it MUST be reported as not computable
- AND it MUST NOT be reported as zero

#### Scenario: An open period's rate is provisional

- GIVEN an allocated period whose end has not passed
- WHEN the rate is rendered
- THEN it MUST be marked provisional
