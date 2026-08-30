---
paths:
  - "src/lib/auth*.ts"
  - "src/lib/app-user.ts"
  - "src/lib/local-mode.ts"
  - "src/proxy.ts"
  - "src/app/auth/**/*.tsx"
  - "src/app/access-pending/**/*.tsx"
  - "src/app/api/auth/**/*.ts"
  - "src/app/api/account*/**/*.ts"
  - "src/app/api/claim-owner/**/*.ts"
---

# Authentication and account lifecycle

- Read `docs/authentication.md` before changing sign-in, registration, account linking, revocation, or route protection.
- Neon Auth owns credentials and sessions; `app_users` owns Fitlog authorization and the numeric `user_id` boundary.
- Construct auth lazily. Importing auth modules must not require environment variables or network access; missing runtime configuration fails closed.
- `isLocalMode()` is the only bypass and must continue requiring explicit opt-in, non-production, and no Vercel environment.
- Normalize identity email with `trim().toLowerCase()`. Never reassign an existing `app_users` row to a different auth user.
- Revoked members remain denied even with a valid Neon session. Only the owner may list or change member access, and the owner cannot be revoked through that endpoint.
- The legacy owner claim is migration-only proof. Keep it one-time and constant-time; never reuse `APP_PASSWORD` as application authentication.
- New auth origins, callbacks, and account-linking behavior require explicit allowlists and tests for unverified, duplicate-email, revoked, and cross-identity cases.
