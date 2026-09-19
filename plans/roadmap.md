# Roadmap

This roadmap orders future capabilities and teaches the intended growth path. OpenSpec changes contain
detailed requirements and tasks; this file contains only sequencing, status, and links to the governing
contract.

## Milestone Tracking

| Phase                                               | Governing changes                                             | Status   |
| --------------------------------------------------- | ------------------------------------------------------------- | -------- |
| Repository evolution conventions                    | `add-repository-evolution-markers`                            | Complete |
| Executable PR and dependency governance             | `add-executable-pr-and-dependency-governance`                 | Complete |
| Foundation                                          | None                                                          | Complete |
| Agent harness and MCP governance                    | `improve-agentic-boiler-governance`                           | Complete |
| Template and example expansion                      | `add-second-example-package`, `add-template-onboarding-guide` | Complete |
| Fork rename automation                              | `add-project-rename-tooling`                                  | Complete |
| Flow observability (phase one)                      | `add-flow-observability`                                      | Complete |
| Ledger dashboard (phase one addendum)               | `add-board-dashboard`                                         | Complete |
| Ledger links and charts (phase one addendum)        | `improve-board-presentation`                                  | Complete |
| Per pull request spend (phase one addendum)         | `add-per-pull-request-spend`                                  | Complete |
| DORA signals (phase one addendum)                   | `add-dora-signals`                                            | Complete |
| Pull request telemetry (workflow governance)        | `add-telemetry-in-pull-request-body`                          | Complete |
| Capture git environment (defect)                    | `fix-capture-git-environment`                                 | Complete |
| Session figures (telemetry capture)                 | `add-session-figures-from-transcript`                         | Complete |
| Review fixes (session figures, Ledger links)        | `fix-transcript-figures-and-board-links`                      | Complete |
| Session trailer default (defect)                    | `fix-session-none-default`                                    | Complete |
| Flow efficiency and work mix (phase one addendum)   | `add-flow-efficiency-and-work-mix`                            | Complete |
| Subscription spend (phase one addendum)             | `add-subscription-spend`                                      | Complete |
| Operator dimension (phase one addendum)             | `add-operator-dimension`                                      | Complete |
| Operator hours from transcript (defect)             | `add-operator-hours-from-transcript`                          | Complete |
| Allocated token rate (phase one addendum)           | `add-allocated-token-rate`                                    | Complete |
| Subscription declarations (phase one addendum)      | `add-subscription-declarations`                               | Complete |
| Provider neutral spend (phase one addendum)         | `add-provider-neutral-spend`                                  | Complete |
| Local configuration surface (phase one addendum)    | `add-local-configuration-surface`                             | Pending  |
| Ledger presentation (phase one addendum)            | `improve-ledger-presentation`                                 | Complete |
| Ledger publication (phase one)                      | `add-board-publication`                                       | Complete |
| Hook drift check (workflow governance)              | `add-hook-drift-check`                                        | Complete |
| Ledger reads after review (defects)                 | `fix-ledger-reads-after-review`                               | Complete |
| Refinements after review (phase one addendum)       | `refine-ledger-after-review`                                  | Complete |
| Task velocity (phase one addendum)                  | `add-task-velocity`                                           | Complete |
| Hours and unit economics (phase one addendum)       | `refine-hours-and-unit-economics`                             | Complete |
| Spec cost classes (phase one addendum)              | `add-spec-cost-classes`                                       | Complete |
| Timesheets (phase one addendum)                     | `add-timesheets`                                              | Complete |
| Registry rollup and statements (phase one addendum) | `add-registry-rollup-and-statements`                          | Complete |
| Zero figures (presentation)                         | `remove-zero-figures`                                         | Complete |
| Ledger redesign (presentation)                      | `redesign-ledger-presentation`                                | Complete |
| Change audit (phase two)                            | `add-change-audit`                                            | Blocked  |

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
the `flow` package (registry, SSH sync, projection, signals, The Ledger); it has no dependency inside this
repository and ends by tagging `v0.1.0`. Change audit adds the `audit` package (rules, levels and packs,
findings, decisions, evidence packs, the git-only baseline, the optional collector) and a governance view on
the same Ledger; phase one is archived and tagged `v0.1.0`, so it is dependency-ready. The R&D cost allocation export, the `regulated`
level's first real case, and further standard packs are later rows.

The Ledger presentation milestone follows the Ledger dashboard milestone because it edits the page that one
introduced: it gives every cited commit its change's subject and a link to the commit on the hosting
platform, and adds the charts the first dashboard left as bare figures. It changes no record, only the
projection's derived repository web URL and the page rendered from it.

The per-pull-request spend milestone follows the Ledger presentation milestone because it adds columns to
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

The session figures row closes the gap that made every spend figure on The Ledger read "figures missing":
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

The subscription spend row exists because every currency figure The Ledger rendered was `$0.00`: validation
requires a subscription session to record no marginal cost, and every recorded session is a subscription
session, so what a plan costs was a fact no record held. It adds a subscription cost record per billing
period and plan, allocates that amount across the period's sessions in proportion to agent run seconds
under the trust class `allocated`, marks an open period provisional, and excludes and counts a session with
no agent seconds rather than giving it zero. It was drafted together with the operator dimension as
`add-subscription-and-operator-spend` and split, because the dimension reverses the accepted rule that no
figure is keyed to an operator and the published position that the tool ranks nobody. The operator
dimension row holds that half, `Blocked` on the flow efficiency row it shares a requirement with and on the
repository owner's decision, and not started; its first task is recording the decision.

The ledger publication row builds The Ledger on every pull request as a run artifact and a job summary, and
deploys it to Pages from the default branch only, gated on the repository being public; the gate lives in
the workflow rather than in a sequencing note, so it cannot be forgotten if visibility ever changes back. It
was first sequenced after the subscription spend row so a published page would not lead with a spend panel
reading zero; the repository owner decided to publish ahead of that row, and the currency figures become
real when it lands. It was archived after its implementation had merged, out of the order the workflow
asks for; the flow efficiency and work mix draft, which modifies the same registry requirement, was rebased
onto the accepted text in the same change.

The operator hours row is a defect fix that follows the operator dimension row directly. Enabling cost
allocation made two operator fields mandatory on every session record while nothing produced them, so all
nineteen committed records failed validation and every new one would have. It derives the figure from the
operator's own prompts in the session transcript — the time they spent prompting in the message thread, with
the harness's own tool traffic excluded, since that traffic would otherwise report an engineer as present
through an unattended agent run — and it stops treating an absent figure as an invalid record, so a missing
operator figure is counted the way every other missing figure in this repository already is. It is
`Blocked` only on archive order: `add-operator-dimension` is implemented and merged but not yet archived, and
this change amends the requirement that one enabled.
The allocated token rate row relates the two figures the subscription work left unrelated: what a period
cost and how many tokens its sessions reported. Input and output lead the denominator and cache reads sit
beside it, because over this repository's own records the two differ by more than two orders of magnitude,
so a combined denominator would track how long a context stayed warm rather than how much work was asked
for. It depends on no active change.
The subscription declarations row answers what a team hits before a solo operator does: one hand-written
record per plan per month is twelve files a year for one plan and thirty-six for three, with a rate change
visible nowhere. It separates the standing arrangement from the month's fact — effective-dated intervals say
what a plan cost and when that changed, and a close command proposes the period's records for an operator to
review and commit. A declaration never becomes a figure on its own; that is the same failure as the
`Session: none` default, and it is avoided the same way. The Board reports the gaps and names the command
that closes each, because it reads only from the projection and its page carries no script and no form.

The provider neutral spend row closes the three places multi-provider work stops short: the rate covers only
allocated spend and not the metered spend a pay-per-token provider reports directly, the reported cost names
a currency in its field name, and cached tokens are one number defined as one provider's reads plus writes.
It follows the allocated token rate row, which it sits beside and whose denominator rule it follows, and
which is now archived.

The local configuration surface row gives an operator running this repository on their own machine what the
published page cannot have. The Board's configuration panel names gaps and the commands that close them
because a static file on a hosting surface has nothing for a form to submit to; an operator with a working
copy and a shell has no such limit, and retyping a command in another window is friction with no safety
behind it. The split is containment rather than visibility: the published artifact carries no editing markup
at all, so a deployment cannot be made to reveal an editor it never held, and the local server binds
loopback, writes only plan declarations and cost records, and never commits. It follows the subscription declarations row, which defines what it edits and is now archived.

The ledger presentation row renames the read surface and reorganises it. The Board was a status display in a
repository that keeps an account, and The Ledger says what the page is in the repository's own vocabulary.
The page had also outgrown one column, with the DORA strip sitting between flow figures that answer a
different question, so the panels were grouped into four tabs — flow, DORA, spend, records — navigated by a
fragment per tab and selected with CSS, because the page may carry no script element and no form control.
The row also adds velocity, story points and changes merged per week, in the unit the configuration already
enables, per repository and never per person.

The hook drift check row closes a gap that cost a merged fix its credibility. `core.hooksPath` may be
relative, which git resolves per working tree, or absolute, which points every worktree at one directory; a
worktree carrying the absolute form runs another checkout's hooks. When `fix-session-none-default` merged,
its own follow-up commits kept carrying the trailer it had removed, because the checkout supplying the hooks
was twenty-six commits behind. Nothing reported it, and nothing could: a hook that is never read cannot say
it was not read. The check compares the hooks git will run with the ones in the current tree and names any
that differ. It warns rather than failing, because the stale checkout is often not the committer's to fix.

The ledger reads after review row corrects what a review of the published page found: a merge commit's
work mix type now comes from its branch commits, the session commands own the session clock, the pull
request script refuses to open an undeclared pull request without an explicit override, the footer states
the accepted boundary, and this repository's rework ignore list covers the files its process edits.

The refinements row follows the ledger reads row and removes the cause behind most of its defects: the
harness runs the session lifecycle, the workflow refuses undeclared work, recording a session is atomic,
spec lead time starts at the proposal, flow efficiency counts only time inside the window, the registry
declares where measurement starts and which pull requests are closed, and notes on figures are records.

The task velocity row replaces a velocity nobody could feed. Story points were never recorded, so the panel
read zero; the tasks in every change's list are the estimate the repository already makes, and a `~N`
weight on a task line gives it a relative complexity. Velocity is now the complexity completed per week.

The hours and unit economics row windows operator hours to the session, keeps hours without an identifier
on the page, puts an allocated figure beside every reported cost-per figure with tasks and their complexity
as units, and fixes the summary strip.

The spec cost classes row answers the research against production question: a class declared once per spec
is inherited by every record citing it, and the class panel carries allocated spend and hours beside
reported cost.

The timesheets row gives hours the shape a retainer needs: by operator, spec, and month, proposed from
the records and confirmed by a committed sheet, never priced.

The registry rollup and statements row completes the multi-repository read the contract promised and
writes the month as rows for finance or a client, each row scoped as a period or window fact.

The zero figures row makes the page keep the rule its records keep: a structural zero reads as absence,
and only a measured zero reads as a count.

The lighter ledger workflow row caches the mirror, skips prose-only pull request builds and unchanged
deploys, and moves the declared-work gate to the check workflow so it still runs on every pull request.

Roadmap changes are ordered left to right within a milestone and top to bottom across milestones. A later
change may be selected only after every earlier governing change is archived and verified. Use `Pending` for
work not started, `In progress` for an active change, `Blocked` when a named dependency is not ready, and
`Complete` only for archived changes with recorded verification. Every row points to a governing change; it
never duplicates that change's requirements or task checklist.

The ledger redesign row follows the zero figures row and changes only the page. The figures were right and
buried: every panel opened with its trust badges and a methodology sentence before its number, the flow tab
was twelve equal cards with work mix first, and the first line under the title was three schema versions.
The row puts the figure first with the methodology folded beneath it, groups panels under the question each
answers, splits the four tabs into three views with sub-views so no view holds more than six panels, and
opens each repository with a headline in words whose every figure links to its panel. Nothing in the
projection changes; the page still carries no script element, no external resource, and no form control.
