# Garmin integration

Fitlog connects to Garmin Connect through the community `garmin-connect` package. This is an unofficial integration over Garmin Connect endpoints, not Garmin's official Health API. Treat upstream shapes, authentication behavior, and availability as unstable external dependencies.

## Boundaries

- The Next.js app owns user identity, encrypted token storage, sync, staging, and imports.
- `workers/garmin-auth/` is a separately deployed Cloudflare Worker used only for the initial Garmin login handshake.
- `scripts/garmin-auth.mjs` is a local fallback that performs the same initial token exchange on the user's machine.
- Garmin credentials are not stored by Fitlog. OAuth token material is stored server-side as AES-256-GCM ciphertext.

Required configuration:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `GARMIN_ENCRYPTION_KEY` | Vercel server only | 32-byte key encoded as exactly 64 hexadecimal characters |
| `NEXT_PUBLIC_GARMIN_WORKER_URL` | Browser | Deployed Cloudflare Worker endpoint |
| `NEXT_PUBLIC_APP_URL` | Server/browser config | Canonical Fitlog callback origin; production is `https://fitlog.site` |

Rotating `GARMIN_ENCRYPTION_KEY` invalidates existing ciphertext unless records are re-encrypted first. The safe fallback is to disconnect and require users to authenticate again.

## Authentication flow

1. An authenticated Fitlog user creates a short-lived row through `/api/garmin/auth-session`.
2. The row contains a random session ID, a random one-time secret, the initiating `user_id`, status, and expiry.
3. The browser sends the user's Garmin email/password plus the handshake values to the configured Worker. The credentials are used once and must never be stored or logged.
4. The Worker authenticates with Garmin and sends either token material or a bounded error to `/api/garmin/auth-callback`.
5. The callback matches a pending, unexpired session and encrypts the token into `garmin_connections` for that session's user.
6. The browser polls only its own auth session and sees completion or a safe error.

The local helper can perform step 3 from the user's machine and POST the result to the same callback. Manual mode prints a token for troubleshooting; treat that output as a credential.

Security invariants:

- Accept Worker browser calls only from fixed Fitlog origins.
- Accept callback destinations only from a fixed Fitlog allowlist; never send credentials or token material to an arbitrary client-provided URL.
- Bind every handshake to its initiating user, reject expiry/reuse, and consume successful completion atomically.
- Never return token ciphertext or plaintext through connection-status APIs.
- Redact provider errors before persisting or displaying them.

## Sync and import

`POST /api/garmin/sync` decrypts the current user's token, loads recent activities and today's optional health metrics, persists a refreshed token, and updates `last_synced_at`.

- Strength activities are filtered out because Fitlog records resistance workouts through its own guided session model.
- Non-strength activities are staged in `garmin_pending_imports` with a per-user activity-ID uniqueness key.
- The user labels a staged activity as easy run, interval run, indoor/outdoor cycling, or Hyrox before it becomes an `activity_session`.
- Daily metrics include resting heart rate, HRV values, sleep duration/score, active/total calories, and steps when Garmin supplies them.
- Optional metric failures do not invalidate an otherwise successful token/activity sync; authentication and callback failures do.
- Disconnect deletes only the encrypted connection. Previously imported Fitlog sessions remain.

All connection, handshake, metric, staging, and activity operations remain scoped to the current Fitlog `user_id`. Coach data may receive normalized health/activity aggregates, never credentials or token material.

## Worker development

Run Worker commands from its own directory:

```bash
cd workers/garmin-auth
npm install
npm run dev
```

`npm run deploy` mutates external production infrastructure and requires explicit authorization. The postinstall patch exists because current transitive dependencies assume Node/Request behavior that Cloudflare Workers does not fully provide; review it when upgrading `garmin-connect`, Axios, or Wrangler.

Tests must mock Garmin responses and cover malformed/partial fields, token refresh, duplicate activities, optional-metric failure, callback expiry/reuse, and cross-account IDs. Do not run automated tests against a real Garmin account.
