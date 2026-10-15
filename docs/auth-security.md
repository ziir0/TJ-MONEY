# Authentication security setup

The application uses Supabase Auth for email/password signup and login. Configure
the Supabase project and Cloudflare Turnstile before enabling public account
creation in production.

## Supabase Auth settings

In **Supabase Dashboard → Authentication → Providers → Email**:

- Keep email confirmations enabled. Users must confirm their address before the
  server accepts their access token.
- Set the minimum password length to **12 characters**. Signup and password
  recovery enforce the same minimum in the UI.
- Enable leaked-password protection if it is available on the project's plan.
  Supabase's Have I Been Pwned password check is plan-dependent.
- Use a custom SMTP provider for production. Supabase's built-in email service
  is intended for evaluation and has a low sending quota (currently 2 emails
  per hour); confirmation and recovery email delivery should be monitored.

In **Authentication → URL Configuration**:

- Set the production Site URL to the canonical HTTPS application origin.
- Allow only the exact production callback URLs:
  `https://<your-domain>/login` and `https://<your-domain>/reset-password`.
- Add exact localhost callback URLs only to development projects, not the
  production allowlist unless required for local work.
- Verify that confirmation links return to `/login` and recovery links return
  to `/reset-password`.

In **Authentication → Rate Limits**:

- Review the current per-IP signup/signin limits, email/OTP sending limits, and
  verification limits. Supabase Auth applies provider-side throttling already;
  tune the configured limits to traffic patterns and monitor 429 responses.
- The hosted default sign-in/signup bucket is documented as 30 requests per
  five minutes per IP; shared office/mobile IPs can make very aggressive limits
  disruptive. Do not raise email limits without configuring custom SMTP.
- Alert on sustained 429s and abuse; this application intentionally does not
  log submitted email addresses or authentication response bodies.

## Cloudflare Turnstile

1. Create a Turnstile widget for the application's production and development
   hostnames.
2. Add its **site key** as `VITE_TURNSTILE_SITE_KEY` in local development and
   the Vercel Production/Preview environments that should allow authentication.
   This is a public client-side key; do not use the secret key here.
3. In **Supabase Dashboard → Authentication → Bot and Abuse Protection**,
   enable CAPTCHA and select **Cloudflare Turnstile**.
4. Paste the Turnstile **secret key** into Supabase's CAPTCHA secret-key field.
   Never commit or expose this key in a `VITE_` variable.
5. Configure the Turnstile hostname allowlist and test signup, login, resend,
   and password-reset requests from each deployed environment.

The client sends each Turnstile token with its Supabase Auth request; Supabase
performs server-side verification using the secret key stored in its dashboard.
No separate application server verification endpoint or secret environment
variable is needed for these Auth flows. The application fails closed when the
site key is absent or the CAPTCHA cannot be completed. A site key alone is not
protection: Supabase must also be configured with the matching secret key and
CAPTCHA enforcement enabled.

## Email confirmation and password recovery

- Signup displays a pending-confirmation state and offers a CAPTCHA-protected
  resend action. Resend responses do not disclose whether an account exists.
- Sign-in indicates when confirmation is required and lets the user request a
  new confirmation email.
- Password recovery uses a generic response to reduce account enumeration. The
  link opens `/reset-password`; a valid recovery session is required to update
  the password. Successful updates sign out and return the user to login.
- The app does not implement MFA in this release. Email confirmation is not a
  second independent authentication factor.

## Security headers and Content Security Policy

Vercel deployment headers set HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, and a restrictive `Permissions-Policy`. The app currently
loads Google Fonts and Supabase assets, so an enforced Content Security Policy
needs a separate inventory and production validation. Roll out a
`Content-Security-Policy-Report-Only` policy first, then enforce it after
reviewing all legitimate scripts, connections, fonts, images, and upload hosts.

## Deployment checklist

- [ ] Configure production `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Configure `VITE_TURNSTILE_SITE_KEY` for every environment where auth is
      expected to work; forms remain blocked without it.
- [ ] Enable email confirmations and set the Site URL / exact callback allowlist.
- [ ] Enable Turnstile CAPTCHA in Supabase and install the matching secret key.
- [ ] Configure custom SMTP, test confirmation/recovery delivery, and monitor
      provider quotas and bounces.
- [ ] Set the password minimum to 12 and enable leaked-password protection if
      available.
- [ ] Review Supabase Auth rate limits and monitor 429s after rollout.
- [ ] Deploy the Vercel SPA rewrites and verify `/reset-password` loads directly
      (the URL fragment containing the recovery token must remain in the browser).
- [ ] Confirm Vercel sends the configured security headers on both the app and
      `/api/*` responses.
