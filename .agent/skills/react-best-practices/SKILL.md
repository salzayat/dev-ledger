---
name: react-best-practices
description: Use when writing, reviewing, or refactoring React components, hooks, state updates, rendering behavior, or performance-sensitive UI code. Based on Vercel Labs React best practices.
license: MIT
metadata:
  source: https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md
---

# React Best Practices

Use this skill when creating, reviewing, or refactoring React code, especially in the future research dashboard.

## Priorities

1. Avoid async waterfalls.
2. Keep bundles small and imports analyzable.
3. Preserve server/client boundaries.
4. Keep client data fetching deduplicated and intentional.
5. Reduce avoidable re-renders without premature memoization.
6. Keep rendering and hydration predictable.

## Async Work

- Check cheap synchronous conditions before awaiting remote values.
- Start independent promises early and await them together with `Promise.all`.
- Move `await` into the branch where the result is actually needed.
- Use Suspense boundaries to stream independently loadable UI.
- Avoid serial fetches across parent and child components when the work can be parallelized.

## Bundle Size

- Prefer direct imports over barrel imports when barrel files pull broad dependency graphs.
- Use statically analyzable import paths.
- Dynamically import heavy, interaction-only UI.
- Defer analytics and other third-party scripts until after the critical page is interactive.
- Load optional code only when a feature is enabled or activated.

## Server And Client Boundaries

- Keep data loading and non-interactive rendering on the server where the framework supports it.
- Pass the minimum serializable data needed by client components.
- Do not pass functions, class instances, or other non-serializable values across server-to-client boundaries.
- Avoid module-level mutable request state in server-rendered code.

## Hooks And State

- Derive values during render instead of mirroring them with effects.
- Use functional state updates when the next value depends on the previous value.
- Use lazy `useState` initialization for expensive initial values.
- Split hooks with unrelated dependencies.
- Move interaction-specific logic into event handlers instead of effects.
- Use `startTransition` for non-urgent UI updates.
- Use `useDeferredValue` when expensive rendering should lag behind responsive input.
- Use refs for transient values that should not trigger renders.
- Do not define components inside components.
- Do not add `useMemo` or `useCallback` by default; use them only when they address a measured or obvious identity or computation problem and match repo conventions.

## Effects

- Keep effect dependency arrays primitive and explicit when practical.
- Do not use effects for pure derivations.
- Put interaction logic in event handlers instead of effects.
- If `useEffectEvent` is used, do not put the effect event result in the dependency array.

## Rendering

- Prefer ternaries over `&&` when rendering values that might be `0`, empty string, or another valid rendered value.
- Extract static JSX outside components when it is large and independent of props.
- Use `content-visibility` or virtualization patterns for very long lists.
- Avoid hydration flicker from client-only values; render stable placeholders or intentionally suppress expected mismatches.
- Use resource hints for critical assets when supported by the framework.

## JavaScript Performance

- Use `Map` or `Set` for repeated membership and lookup operations.
- Avoid repeated `filter().map()` chains in hot paths when one pass is clearer and faster.
- Hoist regular expressions and other loop-invariant work out of loops.
- Use early returns to keep expensive work out of common paths.
- Prefer immutable array helpers such as `toSorted()` when available and appropriate.

## Review Checklist

- No signal, report, or strategy logic is embedded in UI components.
- Data-heavy dashboard views avoid avoidable waterfalls.
- Client components receive only the data they need.
- Effects are not used to duplicate derived state.
- Large dependencies are not imported into the initial route without need.
