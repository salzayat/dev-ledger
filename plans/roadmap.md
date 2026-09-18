# Roadmap

This roadmap orders future capabilities and teaches the intended growth path. OpenSpec changes contain
detailed requirements and tasks; this file contains only sequencing, status, and links to the governing
contract.

## Milestone Tracking

| Phase                                             | Governing changes                                             | Status   |
| ------------------------------------------------- | ------------------------------------------------------------- | -------- |
| Repository evolution conventions                  | `add-repository-evolution-markers`                            | Complete |
| Executable PR and dependency governance           | `add-executable-pr-and-dependency-governance`                 | Complete |
| Foundation                                        | None                                                          | Complete |
| Agent harness and MCP governance                  | `improve-agentic-boiler-governance`                           | Complete |
| Template and example expansion                    | `add-second-example-package`, `add-template-onboarding-guide` | Complete |
| Fork rename automation                            | `add-project-rename-tooling`                                  | Complete |
| Flow observability (phase one)                    | `add-flow-observability`                                      | Complete |
| Board dashboard (phase one addendum)              | `add-board-dashboard`                                         | Complete |
| Board presentation (phase one addendum)           | `improve-board-presentation`                                  | Complete |
| Per pull request spend (phase one addendum)       | `add-per-pull-request-spend`                                  | Complete |
| DORA signals (phase one addendum)                 | `add-dora-signals`                                            | Complete |
| Pull request telemetry (workflow governance)      | `add-telemetry-in-pull-request-body`                          | Complete |
| Capture git environment (defect)                  | `fix-capture-git-environment`                                 | Complete |
| Session figures (telemetry capture)               | `add-session-figures-from-transcript`                         | Complete |
| Review fixes (session figures, Board links)       | `fix-transcript-figures-and-board-links`                      | Complete |
| Session trailer default (defect)                  | `fix-session-none-default`                                    | Pending  |
| Flow efficiency and work mix (phase one addendum) | `add-flow-efficiency-and-work-mix`                            | Pending  |
| Subscription and operator spend (phase one)       | `add-subscription-and-operator-spend`                         | Blocked  |
| Board publication (phase one)                     | `add-board-publication`                                       | Complete |
| Change audit (phase two)                          | `add-change-audit`                                            | Blocked  |

The repository evolution milestone comes first because it establishes the conventions used to plan and
sequence every later capability. The executable PR and dependency governance milestone extends those
conventions with safe body-file handling and dependency readiness checks. The initial foundation is
represented by accepted specs and the runnable `hello` project. The governance milestone is complete because
its change is archived and its accepted requirements are present.

The template and example expansion milestone turns the repository into a usable template for spec and
harness engineering, not just a description of one. `add-second-example-package` comes first because it
demonstrates Nx project boundaries and inter-package dependency sequencing in working code; it is archived.
`add-template-onboarding-guide` comes next because it references `packages/greeter` as part of its
fork/rename/replace-markers checklist, so its predecessor had to exist and be archived first. GitHub's
"Template repository" setting was checked and was already enabled on the hosted remote, and `.github/`
already carries PR/issue templates, CODEOWNERS, dependabot, and CI, so no further governing change is
needed to finish this milestone.

The fork rename automation milestone turns `TEMPLATE.md`'s manual identity-rename table into a single
command (`npm run rename`), because the manual table was already missing several tracked locations (the
npm scope, `tsconfig.base.json`, `openspec/config.yaml`, the `dev-ledger-governance` spec directory)
that a fork owner following it verbatim would leave inconsistent. It comes after the template and example
expansion milestone because it renames the packages that milestone introduced.

The two product milestones are the two phases of this repository, built one week apart. Flow observability
replaces the template's teaching examples with the `capture` package (hooks, trailers, session files) and
the `flow` package (registry, SSH sync, projection, signals, The Board); it has no dependency inside this
repository and ends by tagging `v0.1.0`. Change audit adds the `audit` package (rules, levels and packs,
findings, decisions, evidence packs, the git-only baseline, the optional collector) and a governance view on
the same Board; phase one is archived and tagged `v0.1.0`, so it is dependency-ready. The R&D cost allocation export, the `regulated`
level's first real case, and further standard packs are later rows.

The Board presentation milestone follows the Board dashboard milestone because it edits the page that one
introduced: it gives every cited commit its change's subject and a link to the commit on the hosting
platform, and adds the charts the first dashboard left as bare figures. It changes no record, only the
projection's derived repository web URL and the page rendered from it.

The per-pull-request spend milestone follows the Board presentation milestone because it adds columns to
the tables that one introduced. It also corrects a defect the presentation work exposed: spend on unmerged
pull requests counted a record with missing figures as a real zero, while the merged path excluded and
counted it. Its rule is the accepted one either way — counted, never zeroed.

The pull request telemetry milestone belongs to workflow governance rather than to the product phases: it
puts the records a branch produces into the description a reviewer reads, and corrects two defects in the
same lines — a generated body heading that did not match the repository's own template, and trailers that
were dropped whenever a body file was supplied.

The capture git environment row is a defect fix, not a capability: the flow package already refuses to let
a git child inherit the caller's index, and the capture package — the one whose commands run inside hooks —
did not, which corrupted this repository's index once during the pull request telemetry work.

The session figures row closes the gap that made every spend figure on The Board read "figures missing":
the schema always accepted token counts and nothing produced them. It comes after the capture git
environment fix because its end-to-end test runs a capture command as a child process against a fixture
repository.

The review fixes row corrects five defects a review of the four rows above it found: a transcript's repeated
message kept its first usage record instead of its last, a transcript-filled record kept a source written
before the sum, an SSH host alias derived a dead link for every citation, a pipe could end a table cell in
the pull request body, and two template skill files carried another project's boundary text.

The flow efficiency and work mix row is the last phase one addendum: the reads the flow frameworks ask for
after DORA (flow efficiency, work mix, iterations, abandonment), the product read git can see exactly for a
repository that follows the OpenSpec loop (spec lead time), and the cost figures a preparer asks for once
token counts are real. It follows the DORA signals row for the weekly buckets and the review fixes row for
the figures, and it is drafted rather than started. Every read that needs a review, a check run, a
deployment, or an incident stays in the change audit row.

The session trailer default row is a defect fix, not a capability, and it comes before the rows below it
because it corrects a record every later row reads. Two accepted specs give `Session: none` two meanings:
capture writes it whenever no session is active, and the projection reads it as a declaration that a human
worked without an agent. Because ending a session unsets the active session, every commit made after a
session is recorded — a review fix, a follow-up, a revert — is silently declared human-only, which
falsifies the coverage counts the flow efficiency row accepts. The fix writes no trailer when nothing is
known, leaving the change `undeclared`, and makes the human-only declaration something an operator states.

The subscription and operator spend row comes before board publication because every currency figure The
Board renders is `$0.00` today: validation requires a subscription session to record no marginal cost, and
every recorded session is a subscription session, so what a plan costs is a fact no record holds. It adds a
subscription cost record per billing period, allocates that amount across the period's sessions in
proportion to agent run seconds, and admits the operator as a dimension covering agents and humans alike —
agents in currency, humans in hours, never summed and never priced. It supersedes the accepted prohibition
on operator-keyed figures; pseudonymity stays enforced where it always was, in the record schema. It follows
the flow efficiency and work mix row because both modify `Flow signals per repository and in aggregate`, and
whichever archives second is rebased onto the first.

The board publication row builds The Board on every pull request as a run artifact and a job summary, and
deploys it to Pages from the default branch only, gated on the repository being public; the gate lives in
the workflow rather than in a sequencing note, so it cannot be forgotten if visibility ever changes back. It
was first sequenced after the subscription spend row so a published page would not lead with a spend panel
reading zero; the repository owner decided to publish ahead of that row, and the currency figures become
real when it lands. It was archived after its implementation had merged, out of the order the workflow
asks for; the flow efficiency and work mix draft, which modifies the same registry requirement, was rebased
onto the accepted text in the same change.

Roadmap changes are ordered left to right within a milestone and top to bottom across milestones. A later
change may be selected only after every earlier governing change is archived and verified. Use `Pending` for
work not started, `In progress` for an active change, `Blocked` when a named dependency is not ready, and
`Complete` only for archived changes with recorded verification. Every row points to a governing change; it
never duplicates that change's requirements or task checklist.
