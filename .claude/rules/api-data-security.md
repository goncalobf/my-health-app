---
paths:
  - "src/app/api/**/*.ts"
  - "src/lib/server-data.ts"
  - "src/lib/coach-data.ts"
---

# API ownership and privacy

- Call `requireAppUser()` before private data access. Machine callbacks without a session need a documented, scoped authentication mechanism of their own.
- Scope personal root records to `user.id`. For child records, prove ownership through the parent before reads, inserts, updates, or deletes.
- A referenced exercise must be shared (`owner_user_id IS NULL`) or owned by the current user. Never trust a client-supplied foreign key by itself.
- Return the same `404` for absent and cross-account IDs; do not disclose another account's resource existence.
- Validate unknown bodies before persistence: type, enum, finite numeric range, date, string length, collection size, and upload bytes where applicable.
- Keep credentials and provider calls server-side. Use finite upstream timeouts and bounded retries, and return stable errors without provider internals or secrets.
- Do not log health payloads, search terms, photos, notes, tokens, or model content. Do not send database errors verbatim to clients.
- Do not cache authenticated data unless the cache key and invalidation are demonstrably user-isolated.
- New personal tables require a non-null `user_id` or a mandatory ownership path through a parent, plus migration and cross-account coverage.
