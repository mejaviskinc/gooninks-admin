# Cloudflare security rollout — GoO ninks

Deployment scope: public shop `gooninks.co.id` and separate admin `admin.gooninks.co.id`. Both use Supabase project `etahuzvozoomklsqepyt` for data/auth, while checkout/webhook run directly at Supabase Edge Functions. **Do not change DNS or enable CAPTCHA on production before completing the checklist.**

## Phase 1 — Cloudflare DNS / WAF (account owner)
1. Add `gooninks.co.id` at https://dash.cloudflare.com/. Import and verify the existing `@`, `www`, `admin` records, especially the actual Hostinger server vs GitHub Pages destination, plus MX, SPF, DKIM, DMARC, TXT and CAA. Back up the existing DNS zone first.
2. Copy the two nameservers **assigned to this Cloudflare zone** to the current registrar. Never use example nameservers. If DNSSEC is enabled at the registrar, follow Cloudflare's changeover steps before switching.
3. Proxy only eligible **web** hostnames (`@`, `www`, `admin`) with orange clouds after confirming each origin works on HTTPS. Mail/verification records stay DNS only. Test shop, admin, signup, reset, images, product page, order tracking, and payments before making the change final.
4. SSL/TLS: use **Full (strict)** only when *each proxied origin* has a valid hostname-matching certificate. Enable Always Use HTTPS; HSTS only after successful tests and a rollback plan. Avoid Flexible mode.
5. Enable DDoS protection, Managed WAF rules if available in plan, and limited rate limiting of web admin pages. Prefer Managed Challenge on repeated suspicious requests; avoid challenging every buyer. Do not enable Under Attack mode persistently.
6. **Critical:** `*.supabase.co` Edge Functions and Auth do not automatically pass through the `gooninks.co.id` Cloudflare proxy. Secure them directly with Supabase CAPTCHA/RLS, request validation, and backend rate limiting.
7. Midtrans webhook `/functions/v1/gn-midtrans-webhook` must remain accessible to server-to-server requests. Never place a browser CAPTCHA or Cloudflare browser challenge in front of that callback. Continue verifying Midtrans's SHA512 signature *and* API transaction status on the server, as implemented.
8. Test any Bot Fight Mode against real checkout / monitoring callbacks; Free-plan Bot Fight Mode cannot be excluded with WAF rules. Disable it if legitimate automation is blocked.

## Phase 2 — Turnstile for admin login/signup/password reset
1. Cloudflare > Turnstile > Add widget: hostname `admin.gooninks.co.id`; mode **Managed**. Record its **public sitekey**, keep secret private.
2. Edit `gn-config.js` in the admin site: set `turnstileSiteKey:'<PUBLIC_SITE_KEY>'`. Never put the secret in GitHub or browser JS.
3. Publish and test the new admin page over HTTPS. A Turnstile challenge now appears in login, signup, and forgot-password forms, and tokens are sent to Supabase Auth.
4. **Only after frontend deployment and testing**, enable CAPTCHA in Supabase project `etahuzvozoomklsqepyt`: Authentication > Bot and Abuse Protection > Enable CAPTCHA protection, choose Cloudflare Turnstile, supply the **secret key privately**. Confirm valid tokens pass and missing/reused tokens are rejected.
5. Test login of an authorized owner; signup that still requires owner approval; password-reset email; expired challenge recovery; repeat login attempts; mobile. Do not change Supabase Auth captcha settings ahead of code deployment, or legitimate users may be locked out.
6. The CAPTCHA toggle applies at **Supabase project scope**, not only this admin frontend. Check every other auth client that shares this project before enabling it. CAPTCHA tokens are consumed/expire; the admin code resets the challenge after submission.
7. If unable to complete a phase, leave `turnstileSiteKey` blank and Supabase CAPTCHA disabled. The current login remains unchanged.

## Security Advisor follow-up
- Enable Auth leaked-password protection in Supabase.
- Audit the business authorization checks inside `gn_order_admin_action_v2` and `gn_set_shipping_progress_v1` (both SECURITY DEFINER and callable by authenticated users). Do not revoke access before testing admin functionality; functions may be legitimately required.
- Three RLS-enabled tables with no policies may intentionally be internal-only: `gn_private.owner_emails`, `gn_tracking_events`, `gn_tracking_links`. Investigate whether they should be inaccessible from the Data API.

## Rollback
- Turnstile: disable Supabase CAPTCHA protection **first**, then clear the public sitekey or revert the code release.
- DNS: keep the old zone records and nameservers recorded. If changing DNS again, verify propagation and DNSSEC state.
- WAF: disable the specific new rule or Bot Fight Mode; do not disable the payment webhook's cryptographic validation.
