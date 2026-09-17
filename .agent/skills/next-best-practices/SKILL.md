---
name: next-best-practices
description: Use when creating, reviewing, or refactoring Next.js App Router code, Server Components, routing, metadata, route handlers, scripts, images, fonts, or hydration behavior. Based on Vercel Labs Next.js best practices.
license: MIT
metadata:
  source: https://agenticskills.io/skills/next-best-practices
  upstream: https://github.com/vercel-labs/next-skills/tree/main/skills/next-best-practices
---

# Next.js Best Practices

Use this skill when working on a Next.js dashboard or any future Next.js app in this repository.

## Repository Boundary

- Dashboards may consume immutable reports and generated artifacts.
- Do not put strategy decision logic, parameter optimization, or execution simulation inside Next.js routes or components.
- Keep research behavior governed by OpenSpec and research packages.

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
- Keep heavy data processing and research workloads out of request handlers.

## Directives

- Use `'use client'` only at the smallest boundary that needs browser APIs, state, effects, or event handlers.
- Use `'use server'` for server functions and server actions when needed.
- Use cache directives only when their invalidation behavior is explicit and safe for research outputs.

## Data Patterns

- Prefer Server Components for read-only dashboard data loaded on navigation.
- Use Server Actions for mutations that belong to app interaction, not for research simulation behavior.
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
- For this repository, also run the root research checks when frontend changes affect workflow, docs, or generated outputs.
