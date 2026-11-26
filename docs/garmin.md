# Garmin integration

Fitlog connects to Garmin Connect through the community `garminconnect`
Python package and undocumented Garmin Connect endpoints. This is not Garmin's
official Health API. Treat authentication behavior, response shapes, and
availability as unstable external dependencies.

## Runtime boundaries

- The authenticated Next.js app owns Fitlog user identity, one-time auth
  sessions, encrypted token storage, sync, staging, and imports.
- `api/garmin_auth.py` is a Vercel Python function used only for the credential
  and MFA exchange that the maintained Python client supports.
- `src/lib/garmin-client.ts` performs read-only sync with Garmin's DI Bearer
  tokens and auto-refreshes them. It retains legacy OAuth support so an old
  connection can continue to sync until it is reconnected.
- `workers/garmin-auth/` and `scripts/garmin-auth.mjs` are legacy fallbacks.
  They are not the normal browser flow and use the older OAuth token format.

Required configuration:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `GARMIN_ENCRYPTION_KEY` | Vercel server and Python function | Exactly 32 bytes encoded as 64 hexadecimal characters; encrypts stored tokens and MFA state and derives the internal HMAC signature |
| `GARMIN_AUTH_SERVICE_URL` | Optional Next.js server override | Explicit Python function URL for a non-Vercel development environment; HTTPS is mandatory except for localhost |

Vercel supplies `VERCEL_URL`, so production and preview deployments call their
own `/api/garmin_auth` function without another URL variable. Rotating
`GARMIN_ENCRYPTION_KEY` invalidates stored tokens and in-progress MFA states
unless records are re-encrypted first. The safe fallback is to disconnect and
require users to authenticate again.

## Authentication and MFA flow

1. An authenticated Fitlog user creates a ten-minute row through
   `/api/garmin/auth-session`. It contains a random session ID, random one-time
   secret, initiating `user_id`, status, and expiry.
2. The browser sends the Garmin email/password and handshake to the
   authenticated `/api/garmin/auth` route. Credentials never go directly to a
   public third-party origin.
3. The Next.js route proves that the pending handshake belongs to the current
   Fitlog user. It sends a fresh HMAC-signed server-to-server request to the
   Python function with a finite timeout.
4. The Python function uses the credentials once. If Garmin requires MFA, it
   returns only an opaque AES-256-GCM state containing the pending Garmin
   cookies, Fitlog session ID, and expiry. The password is not included.
5. The browser submits the Garmin verification code, opaque state, and same
   handshake to `/api/garmin/auth`. The Next.js route rechecks ownership before
   the Python function resumes the Garmin login.
6. The Python function returns DI access/refresh tokens only to the signed
   server caller. Next.js atomically consumes the one-time Fitlog session and
   stores the token for that session's user as AES-256-GCM ciphertext.

Security invariants:

- Never persist, log, echo, or put Garmin email/password or MFA codes in error
  text. The Python handler disables its default HTTP request log.
- `/api/garmin_auth` has no browser session, but accepts only a fresh HMAC over
  the exact request body. The signing key stays server-only.
- MFA state is encrypted, expires after ten minutes, and is cryptographically
  bound to the initiating session ID. Completion still requires the random
  Fitlog session secret and current Fitlog user.
- Consume a successful handshake atomically and reject reuse or expiry.
- Never return Garmin token plaintext or database ciphertext to the browser.
- Provider errors are mapped to stable Fitlog messages; response bodies and
  tokens do not enter logs.

The legacy `/api/garmin/auth-callback` remains available only for the local
script/retired Worker. It uses the same one-time session completion helper, so
replay and cross-account completion remain rejected.

## Sync and import

`POST /api/garmin/sync` decrypts the current user's token, loads recent
activities and today's optional health metrics, persists any refreshed token,
and updates `last_synced_at`.

- Current connections use DI Bearer auth and refresh through Garmin's DI OAuth2
  endpoint. Pre-migration `{oauth1, oauth2}` records still use the legacy Node
  client.
- Every undocumented activity value is normalized and bounded before staging.
  Malformed activities are discarded.
- Strength activities are filtered out because Fitlog records resistance
  workouts through its guided session model.
- Non-strength activities are staged in `garmin_pending_imports` with a
  per-user activity-ID uniqueness key. The imported count includes only rows
  actually inserted, not duplicates.
- The user labels a staged activity before it becomes an `activity_session`.
- Daily metrics include resting heart rate, HRV values, sleep duration/score,
  active/total calories, and steps when Garmin supplies them.
- Optional metric failures do not invalidate an otherwise successful activity
  sync. Authentication/activity failures do.
- Disconnect deletes only the encrypted connection. Previously imported
  Fitlog sessions remain.

All connection, handshake, metric, staging, and activity operations stay
scoped to the current Fitlog `user_id`. Coach data receives normalized
health/activity aggregates, never credentials or token material.

## Development and verification

Python dependencies are pinned in `requirements.txt`; Vercel builds
`api/garmin_auth.py` as a Python function. `vercel.json` gives the login enough
time for Garmin's multi-strategy SSO flow. Local `next dev` does not execute
Vercel Python functions, so use mocks for route/unit tests or an explicitly
configured local function URL.

Tests must mock Garmin. Never run automated tests against a real Garmin account.
Cover malformed/partial fields, token refresh, MFA expiry/invalid codes,
duplicate activities, optional-metric failure, handshake expiry/reuse, and
cross-account IDs. Production deployment is a separate authorized action.
