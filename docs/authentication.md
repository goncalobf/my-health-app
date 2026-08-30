# Authentication, registration, and account access

Fitlog uses Neon Auth for credentials, OAuth and sessions. PostgreSQL's
`app_users` table is the application authorization and ownership boundary: its
numeric `id` is the `user_id` attached to every private root record.

## Registration flow

Registration is open; there is no invitation allowlist.

1. A person signs up with email/password or continues with Google at
   `/auth/sign-up`.
2. Neon Auth creates the identity and session.
3. On the first authenticated application request, `getAppUser()` normalizes
   the email, creates an active `app_users` member, and stores the Neon user ID.
4. Fitlog initializes one blank settings row, training-plan state, and seven
   blank schedule days for that numeric user ID.
5. The application layout sends the new account to `/onboarding` before any
   dashboard page.

All personal queries remain scoped to the resulting `app_users.id`. Open
registration does not make any health data public or shared between users.

Concurrent first requests are handled with an email uniqueness conflict guard
and a follow-up identity check. An existing row linked to a different Neon user
ID is never reassigned.

## Google sign-in

The custom auth page starts the supported SDK flow:

```ts
await authClient.signIn.social({
  provider: "google",
  callbackURL: "/",
});
```

Google must also be enabled for the production branch in Neon Console under
**Auth → Configuration → OAuth providers**. Neon can use shared provider
credentials or custom Google client credentials. The canonical production
origin `https://fitlog.site` (and `https://www.fitlog.site` while attached) must
remain in Neon Auth's trusted domains.

The application does not store Google access tokens or request access to
Google fitness, email, calendar, or Garmin data. Google is used only to prove
the person's identity.

## Disabled accounts and legacy owner claim

The owner can list registered accounts and set a non-owner member to `revoked`
through `/api/accounts`. `getAppUser()` denies revoked members even when their
Neon session is still valid. Restoring the status to `active` allows the same
identity to use its existing private records again.

The historical owner row is the only exception to automatic linking. While it
has no Neon user ID, the matching authenticated email is redirected to
`/access-pending` and must prove the former `APP_PASSWORD` once through
`/api/claim-owner`. The password is legacy migration proof, not a sign-in
method.

## Public and protected routes

`src/proxy.ts` runs Neon Auth protection for application and API routes.
`/privacy` and `/terms` are explicitly public so policies are readable before
account creation and even when authentication is temporarily misconfigured.
Private route handlers must still call `requireAppUser()` close to the database
operation; proxy checks are not the ownership boundary.

## Support email and DNS

`fitlog.site` delegates DNS to `ns1.vercel-dns.com` and
`ns2.vercel-dns.com`. As of 30 August 2026 it has no MX, SPF or DMARC records,
so `support@fitlog.site` is reserved in the policy copy but cannot receive mail
yet. Vercel hosts DNS, not email. Before presenting the address as active:

1. choose a mailbox or forwarding provider that can also support replies;
2. add that provider's MX and verification/SPF TXT records in Vercel Domains;
3. configure DKIM and DMARC as recommended by the provider;
4. send an inbound and outbound test; and
5. update the legal copy to remove the activation warning.

Do not point the public legal pages at the owner's personal email without
explicit permission.
