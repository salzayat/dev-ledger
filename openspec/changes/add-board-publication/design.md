# Design: Add Board Publication

## Continuous integration mirrors this repository and never the registry

`telemetry sync` exists to fetch repositories the operator has access to, over that operator's own git
access (`packages/flow/src/sync.ts:28-43`), and `registry.json` is designed to hold repositories other than
this one. A workflow that ran `sync` over the whole registry would need credentials for every entry, would
publish other repositories' flow data from this repository's public page, and would break the moment an
entry became unreachable.

So the override is scoped to a single named entry rather than being a global switch: continuous integration
mirrors `dev-ledger` from its public HTTPS URL and nothing else. The mechanism is a fetch-URL override, not
a registry edit, because `registry.json` is the version-controlled record of what an operator tracks and
should not have to be rewritten to describe where one machine happened to fetch from. The recorded ref tips
are unchanged by which transport fetched them, so the projection built in continuous integration is the same
projection an operator builds locally from the same tips, as
`openspec/specs/flow-observability/spec.md:262` requires.

This also keeps `Sync needs no platform credential` (`openspec/specs/flow-observability/spec.md:37`) true
rather than carving an exception into it. A public HTTPS fetch of a public repository needs no credential at
all, and the platform-issued token used while the repository is private is the one the workflow already
holds for checkout.

## The visibility gate lives in the workflow, not in someone's memory

The repository is private and becomes public after the first release. A deployment step added now would
publish a private repository's flow data — pull request ages, spend, session records — to an unauthenticated
URL, because a Pages site is public on every plan that offers Pages for a private repository, and restricting
its audience needs an Enterprise plan this repository does not have.

Gating the deploy job on `github.event.repository.private == false` puts that condition in the file rather
than in a sequencing note someone has to remember at release time. The workflow lands now, skips its deploy
job while the repository is private, and begins publishing when visibility changes, with no second change and
no window in which the decision depends on someone not forgetting.

## Pull requests render, the default branch publishes

A repository has exactly one Pages site. A pull request that deployed to it would replace the default
branch's board with an unmerged branch's view for everyone, and two open pull requests would overwrite each
other, so the reviewable artifact and the published site cannot be the same surface.

The pull request job therefore builds the page and hands it back two ways: the HTML as a run artifact, for
anyone who wants to open the real page, and the terminal render written into the run's job summary, which is
readable in the run itself and inherits the repository's access control exactly. That second surface is what
makes the pull request job useful while the repository is private, and it stays useful afterwards as the
thing a reviewer reads without downloading anything. Deployment is serialized by a concurrency group because
merges can land closer together than a Pages deployment takes.

## The build needs the whole history, and already has a precedent for it

The projection is rebuilt from commit history, pull head refs, and tags, so a shallow checkout would produce
a different projection than the operator's. `.github/workflows/check.yml:19-21` already checks out with
`fetch-depth: 0` for the same underlying reason, and the board workflow follows it rather than inventing a
narrower fetch that would silently change the result.

## Publishing follows the figures, not the other way round

Every currency figure on the page is `$0.00` today, because validation requires it of a subscription session
(`packages/capture/src/session.ts:132-137`) and all twelve recorded sessions are subscription sessions. The
first thing a public page would show is a spend panel reading zero over a repository's entire recorded
history, which misrepresents the tool more than not publishing does. This change therefore depends on
`add-subscription-and-operator-spend` and is sequenced behind it in the roadmap rather than shipping a
correct pipeline over an empty figure.

Whether the published page renders the operator dimension that change introduces is a separate decision from
whether the page is published at all, and this change does not settle it: it publishes whatever The Board
renders. If the operator dimension should be withheld from the public page specifically, that belongs in a
requirement about The Board's content, not in a workflow.
