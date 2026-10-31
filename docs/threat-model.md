# Threat model

What could go wrong, who might try it, and what stops them. Written for a reviewer or a future maintainer. Each defence points to the code or test that proves it.

## What we protect

1. **Each store's private data:** orders, customer names, emails and addresses, sales figures, staff lists.
2. **Money:** payments, refunds and discount codes.
3. **Accounts:** a merchant's login gives control of their stores; a platform admin's gives control of every store.
4. **Stock:** a store's inventory shouldn't be tied up or changed by outsiders.
5. **The storefronts' integrity:** shoppers must see what the merchant published, not something an attacker injected.

## Who might attack

| Who | What they can already do |
| --- | --- |
| An anonymous visitor or script | Browse storefronts, add to carts, start checkouts, try to sign in |
| A shopper | The above, plus see their own orders and addresses |
| A merchant or staff member of store B | Everything their role allows in store B, and knowledge of how IDs look |
| Someone holding a stolen password | Whatever that account can do |
| A careless or departing staff member | Whatever their role allows, in their own store |

## Threats and defences

### Reaching another store's data (the most important one)

- **Threat:** a store B owner changes an ID in a URL or form to read or change store A's orders, products or customers.
- **Defence:**
  - All store data goes through service functions that take a `StoreContext`, which the server builds from the signed-in user's membership. A store ID sent by the browser is never trusted.
  - Every query filters by `storeId`.
  - Non-members get a 404, which doesn't even confirm the store exists.
- **Proof:** `tests/integration/cross-tenant.test.ts` tries this for every kind of store data. Each module's own tests repeat it (catalog, orders, staff, stock, discounts).
- **Remaining risk:** a future developer writes a query that skips the service layer. Code review and the cross-tenant test file are the guard. Postgres row-level security could add a second net later (see "Not yet done").

### Staff doing more than their role allows

- **Threat:** a fulfilment agent refunds an order, or a manager invites a co-owner.
- **Defence:** every service checks a permission (`requirePermission`), not just the page. Hiding a button is only for clarity. A store can never lose its last owner; changes to owners lock the owner rows, so two owners can't demote each other at the same moment.
- **Proof:** the role tests in `order-operations`, `staff`, `stock-control`, `reports` and `roles` test files.

### Stolen or guessed passwords

- **Defences:**
  - Passwords must be at least 10 characters.
  - Sign-in, sign-up and password reset are rate-limited per IP address. The counters live in Postgres, so a restart doesn't reset them.
  - Email must be verified before signing in.
  - A password reset signs out every other device.
  - Two-step sign-in (an authenticator app plus one-time backup codes) is available to everyone. It is **required** for platform admins, who can't use the dashboard until it's on. Repeated wrong codes lock the account for a while.
- **Remaining risk:** merchants who don't turn on two-step sign-in. A nudge on the overview page could come later.

### Cross-site scripting (injecting a script into a page)

- **Threat:** a product description or store name contains `<script>`, which then runs in a shopper's or merchant's browser and steals their session.
- **Defences:**
  - React escapes all text by default, and the app never uses `dangerouslySetInnerHTML`.
  - A strict Content-Security-Policy only runs scripts carrying a random per-request nonce, so an injected script won't run even if escaping ever failed.
  - Session cookies are `HttpOnly`, so scripts can't read them anyway.
  - Tracking links only accept `http`/`https` (no `javascript:` links).
- **Proof:** `src/lib/content-security-policy.ts` and its unit test; the CSP header is checked in the manual checklist. The `javascript:` rejection is in the order-operations tests.

### Cross-site request forgery (another site submitting forms as you)

- **Threat:** a malicious page makes a signed-in merchant's browser submit "refund" or "invite" to our app.
- **Defences:**
  - Next.js server actions only accept requests whose `Origin` matches the site, and Better Auth checks the origin on its own routes.
  - Session cookies are `SameSite=Lax`, so the browser doesn't send them with cross-site form posts.
  - The only plain route that uses the session is the CSV export, and it is a read-only `GET`. A forged request would download the file into the merchant's own browser, where the attacker can't read it.
  - The Stripe webhook is verified by its signature, not by cookies.

### Clickjacking (our page hidden inside someone else's)

- **Defence:** the CSP sets `frame-ancestors 'none'`, plus `X-Frame-Options: DENY` for older browsers.

### Payment fraud and money errors

- **Paying less than the total:**
  - Prices and totals are always recalculated on the server from the live catalogue.
  - The webhook checks that the amount Stripe charged equals the order total; a mismatch is flagged, not marked paid.
- **Forged "payment succeeded" messages:** webhook signatures are verified, and each event is processed once (unique event IDs).
- **Refunding more than was paid:** the refund amount is reserved with an atomic database update before Stripe is called, so two refunds at once can't go over the total.
- **Discount code abuse:**
  - Usage limits are claimed atomically.
  - Code guessing is rate-limited per visitor per store.
  - Codes only work in the store that created them.
- **Real money moving by accident:** only Stripe test keys are accepted. The browser-test payment stand-in refuses to start unless the site runs on localhost.

### Tying up stock or flooding the system

- **Threat:** a script starts thousands of checkouts to reserve all of a store's stock, or floods email through the invite form.
- **Defences:**
  - Checkout attempts are rate-limited per IP address.
  - Reservations expire and are released.
  - Staff invites are capped per store per hour.
  - CSV exports are limited per user.
  - Uploads are size-limited, then decoded and re-encoded, so a disguised file is rejected.
- **Remaining risk:** a large distributed attack needs a CDN or web firewall in front of the app (Phase 6).

### Leaking secrets and personal data

- **Defences:**
  - Invite tokens are stored only as hashes, are single-use and expire after 7 days.
  - Error reports strip query strings and tokens from paths and never include headers or cookies (`src/server/observability.ts`).
  - The `Referrer-Policy` header stops full URLs, such as invite links, being sent to other sites.
  - The CSV export is never cached (`Cache-Control: no-store`).
  - `.env`, backups and uploads are git-ignored. The audit log stores IDs, not personal details.
- **Spreadsheet formula injection:** CSV cells that start with `=`, `+`, `-` or `@` are prefixed so spreadsheets show them as text (`src/lib/csv.ts`, tested).

### Losing data

- **Defence:** a backup and restore rehearsal is scripted and documented with real output in `docs/backup-restore.md`. Stock changes are an append-only ledger, and orders keep copies of prices and addresses.

## Not yet done (known gaps)

| Gap | Why it matters | When |
| --- | --- | --- |
| Per-merchant Stripe accounts (Stripe Connect), merchant verification, terms | Required before real money | Phase 7 / before launch |
| CDN / web firewall, alerting on the error reports | Large-scale attacks, noticing problems quickly | Phase 6 |
| Malware scanning of uploads | Images are re-encoded, which removes most risk, but a scanner is standard | Before launch |
| Postgres row-level security | A second net if a query ever skips the service layer | Optional hardening |
| Rate limits trust the `X-Forwarded-For` header | Correct behind the hosting platform's proxy, but must be checked against the chosen platform | Phase 6 |
| `npm audit` reports moderate issues in development-only tools | `npm audit --omit=dev` finds 0 in the code that runs in production; the dev-tool issues should still be reviewed | Ongoing |
