---
paths:
  - "src/**/*.{ts,tsx}"
  - "next.config.mjs"
  - "tsconfig.json"
---

# Next.js and TypeScript rules

- This is Next.js 16 with React 19. Read the relevant installed guide under `node_modules/next/dist/docs/` before relying on remembered APIs.
- Keep Server Components as the default. Add `"use client"` only for browser APIs, state, effects, or event handlers.
- Treat route `params`, `searchParams`, cookies, and headers according to the installed Next.js asynchronous APIs. Existing dynamic pages and handlers await `params`.
- Keep server-only modules marked with `import "server-only"` when they access secrets, sessions, or the database.
- Never validate configuration at module scope. Construct clients lazily so importing a module cannot throw while Next collects page data; otherwise any environment without secrets fails to build.
- The React compiler rejects impure calls such as `Date.now()` in component scope. Let a component own its own clock in an effect, and pass a changing `key` to restart it.
- Use the `@/*` alias for `src/*`. Preserve strict TypeScript and avoid `any` unless an untyped external payload is isolated and normalized immediately.
- Validate unknown JSON before use. `Number(...)` must be followed by finite/range checks when the value affects health data or persistence.
- Do not add caching to authenticated or user-specific data without proving cache keys cannot cross accounts. The authenticated app layout is intentionally dynamic.
- Preserve consistent JSON errors in route handlers and actionable user-facing messages in clients.
- Reuse domain functions rather than duplicating macro, phase, date, or progression logic in components or prompts.
