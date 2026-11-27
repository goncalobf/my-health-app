# Garmin integration

Fitlog uses the community `garminconnect` Python package and undocumented
Garmin Connect endpoints outside the official Health API. Endpoint behavior and availability can change
independently of Fitlog.

## Runtime and deployment

The Next.js app owns the Fitlog user identity, handshakes, encrypted
connections, and read-only data sync. The Vercel Python function
`api/garmin_auth.py` exchanges Garmin credentials and MFA codes for DI tokens.
The local script and retired Worker remain compatibility paths for legacy
OAuth tokens.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `GARMIN_ENCRYPTION_KEY` | Next.js and Python | Exactly 64 hexadecimal characters. Both runtimes require the same key. It protects tokens and MFA state and derives the internal signing key. |
| `DATABASE_URL` (or `POSTGRES_URL`) | Next.js and Python | Postgres URL for transactions and durable request deduplication. Both runtimes must use the same database. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Next.js, Vercel system variable | Enables the internal call to a protected deployment URL. |
| `GARMIN_AUTH_SERVICE_URL` | Optional Next.js override | Trusted absolute URL ending in `/api/garmin_auth`, with HTTPS except for localhost outside Vercel. Next.js refuses redirects. |

Apply [migration 0029](../drizzle/0029_garmin_operation_guards.sql) before
deploying this version. It preserves the encrypted connections and adds
handshake fields, per-account operation state, and request nonces. A Garmin
sign-in begun before rollout must be restarted because older handshakes did
not record how they were created.
Rotating the encryption key requires re-encrypting stored connections or asking
users to connect again.

When Vercel supplies both `VERCEL_URL` and the automation bypass, Next.js calls
the Python function on the same deployment. It sends the bypass header only to
that exact deployment origin. Production otherwise uses `https://fitlog.site`.
Preview uses its generated URL and requires the bypass if protected. The
browser calls only the authenticated Next.js routes.
[Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python) ·
[Vercel automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)

## Authentication and MFA

1. The browser starts a ten-minute handshake with
   `POST /api/garmin/auth-session` and `{"purpose":"browser"}`. Starting a
   new handshake invalidates the previous attempt for that Fitlog user.
2. `POST /api/garmin/auth` binds the request to the current user, handshake
   secret, and expected phase. Browser mutations require a trusted origin.
   The database stores a digest of the handshake secret. Only one request
   can claim a phase at a time.
3. Next.js signs the HTTP method, path, timestamp, nonce, and exact request
   body. Python checks the signature and atomically claims the nonce in
   Postgres before contacting Garmin. Each account has durable attempt limits.
4. The Python client uses the submitted credentials for the exchange. If
   Garmin asks for a code, Python encrypts the pending cookies and binds the
   result to the handshake ID. A rejected code can update those cookies while
   retaining the original expiry. A newer challenge replaces the old challenge.
5. After Garmin authenticates, one database transaction consumes the
   handshake and stores the encrypted connection. The browser gets the result
   of the connection, without its token. Verification expiry or a replaced
   handshake requires a new sign-in.

`DELETE /api/garmin/auth-session/:id` cancels the current user's browser
handshake. Disconnect also invalidates any pending handshake and sync lease.
Passwords and MFA codes are transient inputs. Error responses and logs must
keep provider diagnostics, credentials, cookies, and tokens private.

The legacy `/api/garmin/auth-callback` accepts only legacy handshakes. Older
clients can create them with an empty POST body. New legacy callers can use
`{"purpose":"legacy"}`. The callback consumes the expiring secret once. A
user can also submit a legacy token through the authenticated manual endpoint.

## Sync and import

`POST /api/garmin/sync` grants one sync lease to the current Fitlog user. The
lease is checked before each database write, so a superseded connection cannot
store a token, health metrics, or staged activities. DI renewals and legacy
OAuth exchanges persist the new credentials before subsequent Garmin requests.

- Recent activities are normalized and bounded. Strength activities stay out
  of the import queue because Fitlog records them in guided sessions.
- Each activity is staged once per user. The response counts newly staged
  rows. The user labels a staged activity before it becomes an
  `activity_session`.
- The metric date follows Fitlog's configured timezone. Available fields are
  updated independently, preserving existing values when Garmin omits fields.
- Optional metric outages allow activity sync to finish. Rejected credentials,
  token persistence failures, and activity write failures return a failure.
- Disconnect removes the encrypted connection and preserves imported sessions.

## Local verification

Install the pinned requirements with Python 3.12 or 3.13. The Next.js dev
server does not serve the Vercel Python function. Use a local mock or an
explicitly configured local function URL. Fixtures must use synthetic accounts
and avoid live Garmin calls.

Run `npm test` with Node.js 22.15 or later and
`PYTHONPATH=api python -m unittest discover -s tests`. With the local app
running, run `node scripts/test-garmin-ui-local.mjs` for the mobile MFA flow.
Set `GARMIN_TEST_DATABASE_URL` to a disposable local Postgres database with all
migrations applied to include the concurrent handshake, lease and nonce tests.
