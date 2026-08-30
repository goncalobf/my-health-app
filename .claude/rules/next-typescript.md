---
paths:
  - "src/**/*.{ts,tsx}"
  - "next.config.mjs"
  - "tsconfig.json"
---

# Next.js and TypeScript

- This is Next.js 16 with React 19. Read the relevant installed guide under `node_modules/next/dist/docs/` before using framework APIs.
- Server Components are the default; use `"use client"` only for browser APIs, state, effects, or handlers.
- Follow the installed asynchronous APIs for route params, search params, cookies, and headers.
- Mark secret/session/database modules `server-only` and construct environment-dependent clients lazily; imports must remain build-safe without secrets.
- Keep authenticated layouts dynamic and do not cache user data without proven per-user isolation.
- Preserve strict TypeScript. Validate unknown external JSON at its adapter boundary and reuse domain functions instead of duplicating them in UI or prompts.
- Avoid impure values such as `Date.now()` in component render; update clocks in effects and use keys when a timer must restart.
