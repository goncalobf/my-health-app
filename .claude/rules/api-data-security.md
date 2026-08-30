---
paths:
  - "src/app/api/**/*.ts"
  - "src/db/**/*.ts"
  - "src/lib/app-user.ts"
  - "src/lib/auth*.ts"
  - "src/lib/server-data.ts"
  - "src/lib/coach-data.ts"
  - "src/proxy.ts"
---

# API, authentication, and privacy rules

- Call `requireAppUser()` before accessing private application data. A Neon session proves identity; `getAppUser()` creates the isolated Fitlog account on first access and still rejects revoked accounts.
- `isLocalMode()` in `src/lib/local-mode.ts` is the only sanctioned auth bypass. It must keep requiring `FITLOG_LOCAL=1`, no `VERCEL`/`VERCEL_ENV`, and a non-production `NODE_ENV`. Never add a second bypass or relax these guards.
- A deployment without Neon Auth configuration must fail closed. Never fall through to the application unauthenticated.
- Scope every personal select, update, and delete to `user.id`. Never fetch by a client-supplied numeric ID alone.
- Establish nested ownership by joining to the user-owned parent before reading or mutating a routine exercise or session set.
- Before inserting a foreign key, prove the referenced routine/session belongs to the user and the exercise is shared or user-owned.
- Return `404` for missing and cross-account resources so ownership is not disclosed.
- Normalize auth emails with `trim().toLowerCase()`. Registration is open; never add a second invitation gate. Only the owner role may list or disable accounts, and the owner account cannot be revoked through that endpoint.
- Keep the legacy owner-claim comparison constant-time and one-way: never reveal `APP_PASSWORD`, never use it as normal authentication, and never auto-link the unclaimed owner.
- Validate all request bodies and reject non-finite or out-of-range health values before database writes.
- Do not expose database errors, secrets, health payloads, private notes, photos, or AI message bodies in logs or responses.
- Food and coach proxy routes must keep API keys server-only, set finite upstream timeouts, and handle upstream failures without leaking credentials.
- If a schema change introduces personal data, add a non-null `user_id` or an ownership path through a parent and cover it in the migration.
