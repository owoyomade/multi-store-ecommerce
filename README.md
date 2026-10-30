# Storefront Studio — multi-store e-commerce platform

A multi-tenant e-commerce platform where merchants create and run several independent online stores from one dashboard. Each store's data is isolated from every other store.

> **Status: Phase 2 (catalog and storefront) complete.** Accounts, stores, roles, tenant isolation, products, collections, branded storefronts and carts work. Checkout and payments arrive in Phase 3 — see [docs/phase-0-plan.md](docs/phase-0-plan.md).

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

**Storefront (shoppers)**

- Home page, collection pages, product pages with a variant picker, search, price and in-stock filters, sorting and pagination
- Cart stored on the server, identified by a random cookie token; prices always come from the live catalog
- Works on phones (no-JavaScript-required mobile menu) and on store subdomains, e.g. `lumen.localhost:3210`
- Draft stores are only visible to their own staff, as a preview

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
  server/                  server-only code — never sent to the browser
    auth/                  Better Auth config and session helpers
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

## Known limitations (after Phase 2)

- No checkout, orders or payments yet (Phase 3); the cart page says so
- Product options are fixed once a product is created; images can't be reordered (the first upload is the main image)
- Images of draft products can be fetched by anyone who knows the exact URL (it contains a random UUID, so it can't be guessed)
- Uploads are stored on the local disk; an S3-compatible driver arrives with deployment (Phase 6)
- Abandoned carts aren't cleaned up yet
- No staff invite screen or platform-admin pages yet (Phase 4)
- Rate-limit counters are kept in memory, so they reset when the server restarts
- Not deployed anywhere yet (Phase 6)

## Testing

See [docs/manual-test-checklist.md](docs/manual-test-checklist.md) to verify everything by hand.
