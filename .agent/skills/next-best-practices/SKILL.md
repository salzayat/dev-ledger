---
name: next-best-practices
description: Use when creating, reviewing, or refactoring Next.js App Router code, Server Components, routing, metadata, route handlers, scripts, images, fonts, or hydration behavior. Based on Vercel Labs Next.js best practices.
license: MIT
metadata:
  source: https://agenticskills.io/skills/next-best-practices
  upstream: https://github.com/vercel-labs/next-skills/tree/main/skills/next-best-practices
---

# Next.js Best Practices

Use this skill only if a Next.js app is ever added under `apps/`. This repository has none: The Board is a
static page rendered by `packages/flow`, with no script and no loaded resource, and that stays the default.

## Repository Boundary

- An app may render the projection and the session records; it may not compute a figure the projection does not hold.
- No signal, threshold, association, or timing logic inside routes or components; those belong to `packages/flow` and `packages/capture`, governed by OpenSpec.
- No credentials, no network access at build or run time, and nothing keyed to a person.

## File Conventions

- Follow App Router file conventions for `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, and `route.ts`.
- Use route groups, dynamic segments, catch-all segments, parallel routes, and intercepting routes only when they clarify routing behavior.
- For Next.js v16 and later, prefer `proxy` terminology over older `middleware` naming where applicable.

## React Server Components

- Default to Server Components when interactivity is not required.
- Mark only leaf interactive components with `'use client'`.
- Do not make client components `async`.
- Pass only serializable props from Server Components into Client Components.
- Keep server-only dependencies out of client bundles.

## Async APIs

- In Next.js 15 and later, treat `params`, `searchParams`, `cookies()`, and `headers()` as async APIs when required by the framework version.
- Start independent data requests early and await them together.
- Use Suspense boundaries for independently loading sections.
- Avoid parent-child waterfalls caused by waiting for data before rendering a child that could load in parallel.

## Runtime Selection

- Default to the Node.js runtime.
- Use the Edge runtime only when the route benefits from edge locality and its dependency/runtime constraints are acceptable.
- Keep projection rebuilds and other heavy work out of request handlers; they run from the command line.

## Directives

- Use `'use client'` only at the smallest boundary that needs browser APIs, state, effects, or event handlers.
- Use `'use server'` for server functions and server actions when needed.
- Use cache directives only when their invalidation behavior is explicit and safe for a projection that is rebuilt from git.

## Data Patterns

- Prefer Server Components for read-only dashboard data loaded on navigation.
- Use Server Actions for mutations that belong to app interaction, never to write a session record or a projection.
- Use Route Handlers for API-shaped integration points.
- Keep client-side fetching for interactive or browser-specific data.
- Label and render development, validation, and final holdout outputs distinctly.

## Route Handlers

- Use `route.ts` for HTTP endpoints, webhooks, and API-shaped reads.
- Do not combine a `GET` route handler with a `page.tsx` at the same segment when that conflicts with routing behavior.
- Remember route handlers do not run in a React DOM environment.
- Authenticate and authorize privileged routes like any API endpoint.

## Metadata And Assets

- Use static metadata when possible and `generateMetadata` when it depends on route data.
- Use file-based metadata conventions for icons, Open Graph images, and robots/sitemap assets when appropriate.
- Use `next/image` over raw `<img>` unless there is a specific reason not to.
- Configure remote image sources explicitly.
- Provide accurate `sizes` for responsive images.
- Use `next/font` for Google or local fonts to reduce layout shift and external runtime dependencies.

## Scripts And Hydration

- Use `next/script` for scripts that need loading strategy control.
- Give inline scripts an `id`.
- Defer third-party scripts that are not needed for initial rendering.
- Avoid hydration mismatches from dates, random values, browser APIs, invalid HTML, or locale differences.
- Use stable server-rendered placeholders for client-only values.

## Error Handling

- Use route-level `error.tsx` and `not-found.tsx` boundaries.
- Use `redirect`, `permanentRedirect`, and `notFound` for expected control flow.
- Use framework auth helpers such as `forbidden` or `unauthorized` where supported.
- Preserve framework-thrown control-flow errors when catching exceptions.

## Verification

- Run the relevant Nx or package-manager targets for lint, typecheck, test, and build.
- For this repository, also run `npm run check` when frontend changes affect workflow, docs, or generated outputs.
