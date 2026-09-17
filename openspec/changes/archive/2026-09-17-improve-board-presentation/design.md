# Design: Improve Board Presentation

## The web URL is derived in the projection, not read from the registry by the page

The accepted requirement says The Board "SHALL read only from the projection"
(`openspec/specs/flow-observability/spec.md`, Requirement: The Board). Handing `renderBoardHtml` a second
argument carrying `registry.json` would be the smaller diff and would break that rule: the page would then
have two inputs and the terminal render one. So `buildRepositoryProjection`
(`packages/flow/src/projection.ts:129`) resolves the registry URL to a web URL once and records it on the
repository, exactly as it already records `defaultBranch` and `refTips` from the entry.

What is recorded is the derived `https://<host>/<owner>/<repo>` string, never the registry URL itself. A
registry entry may legitimately be a local path — the test fixture registers `fixture.dir` under `tmpdir()`
(`packages/flow/src/board-html.test.ts:49-58`) — and writing that path into the projection would make the
projection differ between two machines holding identical ref tips, which the "Two machines rebuild
identically" scenario forbids. A URL that does not parse as a GitHub remote yields `null`, and the page
renders the same text without an anchor. The same parse covers `git@github.com:owner/repo.git`,
`ssh://git@github.com/owner/repo.git`, and `https://github.com/owner/repo`, including GitHub Enterprise
hosts, because all three are already accepted by `syncRepository`'s `git clone --mirror`.

Adding a field is a projection shape change, so `PROJECTION_SCHEMA_VERSION` goes to 2
(`packages/flow/src/projection.ts:33`). The version is rendered in the page header, so a stale projection
is visible rather than silently mixed with a new page.

## A citation is one renderer, dispatching on the shape of the cite string

Cites are not all commits. `computeSignals` emits four shapes: a 40-character change id
(`packages/flow/src/signals.ts:164`), `pull/<number>` for queue-age signals
(`packages/flow/src/signals.ts:468`), a session record path such as
`.telemetry/sessions/2026-09/s-1.json` (`packages/flow/src/signals.ts:147`), and the page itself builds
`<later>&lt;-<earlier>` for rework pairs (`packages/flow/src/board-html.ts:303`). The existing `short()`
already splits on `<-`, which is why the pair shape works at all today.

Rather than teaching each call site about links, one `cite()` renders any of the four: it splits on `<-`,
and for each part decides between a commit link, a pull request link, a blob link on the default branch,
and plain text. Titles come from a `Map<hash, subject>` built once per repository from
`repository.changes`, so a citation of a change not on the default branch (there is none today, but a
rework pair or an escape could name one) degrades to the hash alone rather than throwing.

The change id is the change's `lastCommit` (`packages/flow/src/history.ts:189`), which is a commit that
exists in the repository for all three change kinds, so `/commit/<id>` is a valid target for every cited
change, including a merge-commit change where the id is the branch tip rather than the merge.

## Self-containment is about loaded resources, not about anchors

The current test asserts `doesNotMatch(html, /https?:\/\//)`
(`packages/flow/src/board-html.test.ts:76`), which is a proxy for "no external resource" that a platform
link necessarily trips. The accepted scenario's words are "contains no script element and references no
external resource" — a resource is something the page loads while rendering. The replacement assertions
check what actually matters and are stricter in every direction that matters: no `<script`, no `<link`,
no `src=`, no `url(` and no `@import` in the style block. An anchor is checked separately, for the
opposite property: that it points where the registry says and nowhere else.

The page still opens from a `file://` URL with no network; the links are inert until clicked.

## Visualizations are computed in the renderer, not added to the projection

Every new chart is a fold over records the projection already carries: merge activity buckets
`changes[].mergeTime` by day, the batch-size chart reads `insertions`/`deletions` per change, the queue
chart reads `signals.queue.pullRequests[].oldestCommitAt` against `asOf`, and the rework chart counts
`signals.rework.pairs[].files`. Putting any of these in the projection would add a second representation of
the same facts that a rebuild would have to keep consistent; the page is cheap to re-render, so the fold
lives in the page.

The charts are inline `<svg>` with a `viewBox` and `width="100%"`, the pattern `bars()` already uses, so
they scale to phone width without a media query per chart. Colors are the existing CSS custom properties,
which are already redefined under `prefers-color-scheme: dark`, so no chart carries a hard-coded color.
