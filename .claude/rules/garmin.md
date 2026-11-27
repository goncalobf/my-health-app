---
paths:
  - "src/lib/garmin*.ts"
  - "src/app/api/garmin/**/*.ts"
  - "src/components/Garmin*.tsx"
  - "scripts/garmin-auth.mjs"
  - "api/garmin_auth.py"
  - "requirements.txt"
  - "workers/garmin-auth/**/*"
---

# Garmin integration

- Read `docs/garmin.md` before changing authentication, MFA state, token storage, sync, imports, or either legacy auth fallback.
- Credential exchange uses the community Python `garminconnect` SDK. The legacy Node OAuth client remains for existing connections. Treat Garmin Connect responses as undocumented.
- Garmin usernames/passwords are one-use login inputs. Never persist, log, echo, or include them in errors; the Python function must discard them after token exchange.
- Store Garmin session tokens only as AES-256-GCM ciphertext using the server-only `GARMIN_ENCRYPTION_KEY`. Never expose encrypted blobs or plaintext tokens to clients or logs.
- Auth handshakes require a random, expiring, one-time secret bound to the initiating user. Consume completion atomically and reject reuse or expiry.
- The Python function accepts only fresh HMAC-signed server-to-server requests and consumes each nonce once in Postgres. MFA state is encrypted, expires, and is bound to its Fitlog auth session. Never forward credentials or tokens to a client-selected host.
- Scope connections, auth sessions, daily metrics, staged activities, imports, and disconnects to `user.id`; Garmin activity IDs are unique per user, not globally.
- Strength activities stay out of the cardio import queue. Imported activities remain after disconnect unless product behavior explicitly changes.
- Separate optional metric failures from token/auth failures. Keep existing metrics when fields are absent. Persist rotated credentials before further provider calls and enforce the current sync lease on every write.
- Normalize and bound every undocumented Garmin value before persistence. Test with fixtures; unit tests must not call Garmin live.
- `api/garmin_auth.py` deploys with the Vercel app. `workers/garmin-auth/` is legacy and has its own retired deployment lifecycle; never redeploy it without explicit authorization.
