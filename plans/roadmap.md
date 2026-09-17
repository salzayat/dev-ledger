# Roadmap

This roadmap orders future capabilities and teaches the intended growth path. OpenSpec changes contain
detailed requirements and tasks; this file contains only sequencing, status, and links to the governing
contract.

## Milestone Tracking

| Phase                                        | Governing changes                                             | Status   |
| -------------------------------------------- | ------------------------------------------------------------- | -------- |
| Repository evolution conventions             | `add-repository-evolution-markers`                            | Complete |
| Executable PR and dependency governance      | `add-executable-pr-and-dependency-governance`                 | Complete |
| Foundation                                   | None                                                          | Complete |
| Agent harness and MCP governance             | `improve-agentic-boiler-governance`                           | Complete |
| Template and example expansion               | `add-second-example-package`, `add-template-onboarding-guide` | Complete |
| Fork rename automation                       | `add-project-rename-tooling`                                  | Complete |
| Flow observability (phase one)               | `add-flow-observability`                                      | Complete |
| Board dashboard (phase one addendum)         | `add-board-dashboard`                                         | Complete |
| Board presentation (phase one addendum)      | `improve-board-presentation`                                  | Complete |
| Per pull request spend (phase one addendum)  | `add-per-pull-request-spend`                                  | Complete |
| Pull request telemetry (workflow governance) | `add-telemetry-in-pull-request-body`                          | Complete |
| Capture git environment (defect)             | `fix-capture-git-environment`                                 | Complete |
| Session figures (telemetry capture)          | `add-session-figures-from-transcript`                         | Complete |
| Change audit (phase two)                     | `add-change-audit`                                            | Blocked  |

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

Roadmap changes are ordered left to right within a milestone and top to bottom across milestones. A later
change may be selected only after every earlier governing change is archived and verified. Use `Pending` for
work not started, `In progress` for an active change, `Blocked` when a named dependency is not ready, and
`Complete` only for archived changes with recorded verification. Every row points to a governing change; it
never duplicates that change's requirements or task checklist.
