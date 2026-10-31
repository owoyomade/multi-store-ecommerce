# Storefront Studio — multi-store e-commerce platform

A multi-tenant e-commerce platform where merchants create and run several independent online stores from one dashboard. Each store's data is isolated from every other store.

> **Status: Phase 3 (checkout and orders) complete.** Accounts, stores, roles, tenant isolation, catalog, branded storefronts, carts, Stripe test-mode checkout, orders and customer accounts work. Merchant order operations (fulfil, cancel, refund), discounts and staff invites arrive in Phase 4 — see [docs/phase-0-plan.md](docs/phase-0-plan.md).

## What works today

**Accounts and stores**

- Sign up with email + password, email verification, sign in/out, password reset, rate limiting
- Create a store (name, address, region, currency, brand colours); publish or unpublish it
- Two storefront styles (Classic and Bold) plus a tagline, so stores look clearly different
- Four staff roles (Owner, Manager, Inventory editor, Fulfillment agent) with a permission map
- One account can belong to many stores with a different role in each

**Catalog (merchant dashboard)**

- Products with up to two options (e.g. Size × Colour); a variant is created for every combination
- Per-variant SKU, price, compare-at ("was") price and stock, edited in one table
- Draft / Published / Archived status, SEO title and description
- Image uploads (JPEG, PNG, WebP, AVIF up to 5 MB): every file is decoded and re-encoded as WebP, which rejects disguised files and strips metadata such as GPS location
- Collections to group products
- Stock changes are recorded in an inventory ledger

**Storefront themes**

- **Classic** (demo: Northbrew Coffee): the homepage is built like a maker's printed label. The store's label card sits over a full-screen photograph and shrinks to a stub as you scroll; then one product in full (pick options and add to cart on the spot), the whole catalogue as a printed price list, and the founder's letter on paper.
- **Bold** (demo: Lumen Studio Apparel): a split stage. One half of the screen is a picture that stays put and slowly crossfades while the other half scrolls through a striped card, the featured product, the founder's letter and the collections set as large poster lines; the footer is half photograph, half menu.
- Both themes are filled from each store's own data (brand colours, tagline, hero picture, facts, featured product, founder's letter, credited pictures). Every part is optional, so a new store still gets a complete homepage from its products alone.
- Demo pictures come from open museum and archive collections (public domain, CC0 or CC BY) and are credited in each store's footer; their sources are listed in `prisma/seed-assets/*/credits.json`. Product images in the demo are flat illustrations that stand in for product photography.

**Storefront (shoppers)**

- Home page, collection pages, product pages with a variant picker, search, price and in-stock filters, sorting and pagination
- Cart stored on the server, identified by a random cookie token; prices always come from the live catalog
- Works on phones (no-JavaScript-required mobile menu) and on store subdomains, e.g. `lumen.localhost:3210`
- Draft stores are only visible to their own staff, as a preview

**Checkout and orders**

- Checkout as a guest or signed in; totals (subtotal, demo shipping, demo tax) are always calculated on the server from current catalog prices
- Stock is reserved during checkout with an atomic database update, so two shoppers can't buy the last unit; abandoned or cancelled checkouts release it
- Payment on Stripe's hosted page in **test mode only** (live keys are refused), behind a provider interface so others can be added
- Signed Stripe webhooks mark orders paid; each event is processed once, and the charged amount is checked against the order
- Order numbers per store (#1001, #1002…), item price/name snapshots, and a status history recording who changed what
- Order confirmation email; confirmation page; signed-in shoppers get order history and saved addresses
- Read-only orders list and order detail in the merchant dashboard

**Security**

- Tenant isolation: staff only ever see stores they belong to; another store's products, variants, collections, images and carts can't be reached by changing IDs (integration tests check each one)
- Audit log entries for store, product and stock changes
- Health endpoint at `/api/health`

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · PostgreSQL 17 · Prisma 7 · Better Auth · Zod · Tailwind CSS 4 · sharp (image processing) · Vitest · Docker Compose (Postgres + Mailpit)

## Running it locally

### Prerequisites

- Node.js 24 or newer
- Docker Desktop (running)

### Setup

```bash
npm install
```

```bash
cp .env.example .env
```

Open `.env` and replace `BETTER_AUTH_SECRET` with a random value (`openssl rand -base64 32` generates one).

```bash
docker compose up -d
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:3210. Emails (verification, password reset) are caught by Mailpit at http://localhost:8030.

The demo storefronts are at http://localhost:3210/s/northbrew and http://localhost:3210/s/lumen, or on their own subdomains: http://northbrew.localhost:3210 and http://lumen.localhost:3210 (Chrome, Edge and Firefox resolve `*.localhost` automatically).

> This project uses non-default ports (app 3210, Postgres 5440, Mailpit 1030/8030) so it can run next to other local projects.

### Payments (optional, Stripe test mode)

Without Stripe keys everything works except the final "Continue to payment" step, which says payments aren't set up. To try a full purchase:

1. Create a free account at https://dashboard.stripe.com and stay in **Test mode**.
2. Under Developers → API keys, copy the **Secret key** (`sk_test_...`) into `STRIPE_SECRET_KEY` in your `.env`. Live keys are rejected.
3. Install the Stripe CLI and log in. It forwards Stripe's webhooks to your computer:

   ```bash
   brew install stripe/stripe-cli/stripe
   ```

   ```bash
   stripe login
   ```

4. Start forwarding and copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET`:

   ```bash
   stripe listen --events checkout.session.completed,checkout.session.expired --forward-to localhost:3210/api/webhooks/stripe
   ```

5. Restart `npm run dev`, then buy something with card `4242 4242 4242 4242`, any future expiry date and any CVC.

### Demo accounts

`npm run db:seed` creates these accounts, plus a catalog for each store (about ten products, collections, a sold-out item and a draft). Product images are generated placeholder art. All accounts use the password set in `SEED_DEMO_PASSWORD` in your `.env`.

| Email                         | Access                                             |
| ----------------------------- | -------------------------------------------------- |
| `admin@example.test`          | Platform admin                                     |
| `maya@northbrew.example.test` | Owner of Northbrew Coffee (CAD, Canada)            |
| `theo@lumen.example.test`     | Owner of Lumen Studio Apparel (USD, United States) |
| `sam@example.test`            | Manager at Northbrew, Fulfillment agent at Lumen   |

## Scripts

| Command                           | What it does                                                      |
| --------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                     | Start the app in development mode                                 |
| `npm run build` / `npm start`     | Production build / run it                                         |
| `npm run lint`                    | ESLint                                                            |
| `npm run typecheck`               | Generate route types and run the TypeScript compiler              |
| `npm run format` / `format:check` | Prettier                                                          |
| `npm test`                        | Unit + integration tests (uses the separate `shop_test` database) |
| `npm run db:migrate`              | Create/apply database migrations                                  |
| `npm run db:seed`                 | Load demo data (safe to run more than once)                       |

## Project structure

```
src/
  app/                     pages and route handlers
    (auth)/                sign-up, sign-in, password reset
    dashboard/             store list, create-store wizard, per-store dashboard
    s/[storeSlug]/         public storefront (subdomains are rewritten here by src/proxy.ts)
    media/                 serves uploaded product images
    api/auth/[...all]/     Better Auth endpoints
    api/health/            health check
    api/webhooks/stripe/   signed Stripe webhook endpoint
  server/                  server-only code — never sent to the browser
    auth/                  Better Auth config and session helpers
    payments/              PaymentProvider interface and the Stripe implementation
    storage/               file storage driver and safe image processing
    tenancy/               StoreContext: who is acting in which store
    permissions/           role → permission map
    services/              business logic (all store data goes through here)
    email/                 SMTP mailer and email templates
  lib/                     code shared by browser and server (validation, form state)
  components/              shared UI components
prisma/                    schema, migrations, seed script
tests/                     unit and integration tests
docs/                      design plan and manual test checklist
```

## How tenant isolation works

Every store-owned row has a `storeId`. Pages and server actions never query store data directly; they call a service function that takes a `StoreContext` (store ID, user ID, role). That context is built on the server from the signed-in user's membership row — a store ID sent by the browser is never trusted. Non-members get a 404, so they can't even confirm a store exists. Integration tests in `tests/integration/store-tenancy.test.ts` check this.

## Known limitations (after Phase 3)

- Merchants can view orders but can't yet fulfil, cancel or refund them from the dashboard (Phase 4)
- No discount codes yet (Phase 4)
- All stores share one Stripe test account. Before real merchants, each store needs its own connected account (Stripe Connect), plus verification and legal terms
- Tax and shipping are simple per-store demo rates, not real tax calculation
- Shopper accounts work on `/s/<store>/...` paths; on store subdomains shoppers check out as guests (the sign-in cookie belongs to the main domain)
- Product options are fixed once a product is created; images can't be reordered
- Homepage content (hero picture, facts, featured product, founder's letter) is stored per store and validated, but there is no dashboard screen to edit it yet; the demo stores get theirs from the seed script. The founder's letters and facts are sample copy.
- Storefront pictures can't be video yet
- Uploads are stored on the local disk (S3-compatible storage arrives in Phase 6)
- Abandoned carts aren't cleaned up yet; expired stock reservations are released when the next checkout starts
- Rate-limit counters are kept in memory, so they reset when the server restarts
- Not deployed anywhere yet (Phase 6)

## Troubleshooting

- **"Cannot read properties of undefined (reading 'findMany')" after a migration:** the dev server is still using the database client from before the schema change. Stop and restart `npm run dev`.
- **Checkout says payments aren't set up:** add both Stripe values to `.env` and restart the dev server.
- **Orders stay on "Confirming your payment…":** the webhook isn't reaching the app. Check that `stripe listen` is running and that `STRIPE_WEBHOOK_SECRET` matches the value it printed.

## Testing

See [docs/manual-test-checklist.md](docs/manual-test-checklist.md) to verify everything by hand.
