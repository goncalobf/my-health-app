---
paths:
  - "src/lib/garmin*.ts"
  - "src/app/api/garmin/**/*.ts"
  - "src/components/Garmin*.tsx"
  - "scripts/garmin-auth.mjs"
  - "workers/garmin-auth/**/*"
---

# Garmin integration

- Read `docs/garmin.md` before changing authentication, token storage, sync, imports, or the Cloudflare Worker.
- This uses the community `garmin-connect` client, not Garmin's official Health API. Do not describe it as official or assume undocumented responses are stable.
- Garmin usernames/passwords are one-use login inputs. Never persist, log, echo, or include them in errors; the worker must discard them after token exchange.
- Store OAuth tokens only as AES-256-GCM ciphertext using the server-only `GARMIN_ENCRYPTION_KEY`. Never expose encrypted blobs or plaintext tokens to clients or logs.
- Auth handshakes require a random, expiring, one-time secret bound to the initiating user. Consume completion atomically and reject reuse or expiry.
- Worker origins and callback destinations use fixed Fitlog allowlists. Never forward credentials or tokens to a client-selected host or reflect an untrusted CORS origin.
- Scope connections, auth sessions, daily metrics, staged activities, imports, and disconnects to `user.id`; Garmin activity IDs are unique per user, not globally.
- Strength activities stay out of the cardio import queue. Imported activities remain after disconnect unless product behavior explicitly changes.
- Separate optional metric failures from token/auth failures. Do not silently turn an authentication or callback failure into a successful sync.
- Normalize and bound every undocumented Garmin value before persistence. Test with fixtures; unit tests must not call Garmin live.
- The worker has its own package and deployment lifecycle. Run its commands from `workers/garmin-auth/` and never deploy it without explicit authorization.
