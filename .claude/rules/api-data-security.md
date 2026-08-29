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

- Call `requireAppUser()` before accessing private application data. A Neon session proves identity, not Fitlog invitation status.
- Scope every personal select, update, and delete to `user.id`. Never fetch by a client-supplied numeric ID alone.
- Establish nested ownership by joining to the user-owned parent before reading or mutating a routine exercise or session set.
- Before inserting a foreign key, prove the referenced routine/session belongs to the user and the exercise is shared or user-owned.
- Return `404` for missing and cross-account resources so ownership is not disclosed.
- Normalize invitation and auth emails with `trim().toLowerCase()`. Only the owner role may list or mutate invitations, and the owner account cannot be revoked through that endpoint.
- Keep the legacy owner-claim comparison constant-time and one-way: never reveal `APP_PASSWORD`, never use it as normal authentication, and never auto-link the unclaimed owner.
- Validate all request bodies and reject non-finite or out-of-range health values before database writes.
- Do not expose database errors, secrets, health payloads, private notes, photos, or AI message bodies in logs or responses.
- Food and coach proxy routes must keep API keys server-only, set finite upstream timeouts, and handle upstream failures without leaking credentials.
- If a schema change introduces personal data, add a non-null `user_id` or an ownership path through a parent and cover it in the migration.
