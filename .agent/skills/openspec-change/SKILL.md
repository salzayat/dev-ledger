---
name: openspec-change
description: Scaffold a new OpenSpec change (proposal.md, design.md, tasks.md, specs/<capability>/spec.md) for this repo's spec-driven workflow. Use whenever the user wants to propose a new capability, fix a behavioral defect, or otherwise start work that should go through openspec/changes/ before code — including phrases like "draft an OpenSpec change for X", "propose a fix for Y as a spec", "create a change for Z", or when AGENTS.md's rule to spec before coding applies and no matching change exists yet.
---

# OpenSpec Change Scaffolding

This repo treats `openspec/specs/` as the accepted behavioral
contract and `openspec/changes/<name>/` as a proposed delta against it. AGENTS.md requires reading specs
before implementing and updating them when implementation reveals an ambiguity — this skill produces the
first draft of that delta, not the implementation.

A good first draft here is worth more than a fast one: three real bugs got caught in this repo's own
drafts only because someone reread the actual code after writing the prose. This skill's job is to do
that rereading _before_ the prose is final, not after.

## Inputs

You need two things from the user (ask if either is missing):

1. **A change name** in kebab-case following the repo's existing verbs — `add-` for a new capability,
   `fix-`/`correct-` for correcting a defect, `replace-`/`retire-` for superseding something. Check
   `openspec/changes/` and `openspec/changes/archive/` for name collisions before settling on one.
2. **A one-paragraph description** of the problem or capability. Push back gently if it's too vague to
   ground in code (e.g. "make it more secure") — ask what concrete behavior should change.

## Step 1: Ground it in the actual codebase before writing anything

This is the step that gets skipped under time pressure and is the single biggest source of bad first
drafts. Before writing a word of `proposal.md`, go find the real code the change touches:

- Grep/read the module(s) the change would affect. Note exact `file.py:123` locations for every claim
  you're about to make — "the connector reads its credential via X" should point at a line, not a guess.
- If the change references an existing capability (e.g. it modifies `economic-calendar` or
  `artifact-authority-enforcement`), read that capability's current `openspec/specs/<capability>/spec.md`
  in full. Don't add a requirement that already exists under a different title, and don't contradict one
  that's still accurate.
- If the change depends on or builds on another change (existing or one you're drafting in the same
  session), find it and note the dependency explicitly — this repo's own proposals do this in prose in
  the Why/design sections since OpenSpec has no first-class dependency field.

While you're in the code, actively look for the three mistakes below — they're not hypothetical, they're
things that got written into this repo's own change proposals and only caught by a second, skeptical pass:

**1. An invariant that isn't actually true of the code.** A requirement like "X must map to exactly one
Y" or "every Z has property W" is a testable claim about the codebase as it exists right now — grep for
counterexamples before asserting it. (Concretely: a draft here once required a 1:1 mapping between a
credential and the connector that uses it, which would have failed immediately because one credential is
legitimately read by two separate connectors in this codebase.)

**2. A verification mechanism that doesn't exist for the thing being verified.** If a requirement says
"verify X matches a literal string/host/value in the module," confirm that module actually contains such
a literal — some connectors go through an SDK client object with no string to match against, and a
verification task written against that connector needs a different mechanism (e.g. "verify it constructs
the SDK client class," not "grep for a URL that isn't there").

**3. A new required field on an artifact type that's already immutable and already in production.** If
the design adds a permission/authority/classification _field_ that a payload must carry, check whether
that artifact type is already checksummed and already has real instances on disk. If so, no existing
instance can ever satisfy the new field — the artifact-immutability rules in this repo mean you can't
edit a published file to add one. The fix is almost always a separate, reviewed classification table
keyed by schema version (or producing module), not a field on the payload itself.

## Step 2: Write the four files

Read `references/template.md` for the exact skeleton and a worked example of each file (drawn from this
repo's own `add-hypothesis-trial-registration` change). Match its structure precisely — this repo's
`openspec validate --strict` and its human reviewers both expect it:

- `proposal.md` — Why (grounded in file:line evidence), What Changes, Non-Goals
- `design.md` — the architectural reasoning behind non-obvious decisions, each tied to a real location in
  the code
- `tasks.md` — numbered checklist grouped by section, always ending in a verification section; each task line
  carries a relative complexity after its id (`- [ ] 1.2 ~3 ...`), on a 1, 2, 3, 5, 8 scale, so velocity
  can be read from the list
- `specs/<capability>/spec.md` — the delta itself: `ADDED`/`MODIFIED`/`REMOVED`/`RENAMED` Requirements,
  each with MUST/MUST NOT prose and at least one Given/When/Then Scenario

Use an existing `openspec/specs/<capability>/` name if this change modifies a capability that already has
one; otherwise pick a new capability name that matches the change's actual subject, not its change-name
verb (e.g. capability `connector-registry` for change `add-connector-registry`).

Every Non-Goal and every "MUST NOT" should name something a reader could actually go check — "no live
order placement" is checkable (grep for order-placement code); "doesn't make things worse" is not.

## Step 3: Validate and report

Run:

```bash
openspec validate <change-name>
```

Fix any errors it reports before finishing. Then tell the user plainly: this is a first draft. The
validator only checks structure (well-formed sections, at least one scenario per requirement) — it cannot
tell them whether the three mistakes above are actually absent. Recommend they (or you, in a follow-up
pass) reread the finished draft once against the code specifically looking for those three failure modes,
the same way this repo's own drafts were caught and fixed.
