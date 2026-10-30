# Storefront Studio — multi-store e-commerce platform

A multi-tenant e-commerce platform where merchants create and run several independent online stores from one dashboard. Each store's data is isolated from every other store.

> **Status: Phase 1 (foundation) complete.** Accounts, store creation, roles and tenant isolation work. Catalog, storefront, checkout and payments arrive in later phases — see [docs/phase-0-plan.md](docs/phase-0-plan.md).

## What works today

- Sign up with email + password, email verification, sign in/out, password reset
- Rate limiting on sign-in and other auth endpoints
- Create a store (name, address/slug, region, currency, brand colours) — the creator becomes its Owner
- Store dashboard with a launch checklist and a settings page
- Four staff roles (Owner, Manager, Inventory editor, Fulfillment agent) with a permission map
- One account can belong to many stores with a different role in each
- Tenant isolation: users only ever see stores they belong to; other stores return 404
- Audit log entries for store creation and settings changes
- Health endpoint at `/api/health`

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · PostgreSQL 17 · Prisma 7 · Better Auth · Zod · Tailwind CSS 4 · Vitest · Docker Compose (Postgres + Mailpit)

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

> This project uses non-default ports (app 3210, Postgres 5440, Mailpit 1030/8030) so it can run next to other local projects.

### Demo accounts

`npm run db:seed` creates these accounts. They all use the password set in `SEED_DEMO_PASSWORD` in your `.env`.

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
    api/auth/[...all]/     Better Auth endpoints
    api/health/            health check
  server/                  server-only code — never sent to the browser
    auth/                  Better Auth config and session helpers
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

## Known limitations (Phase 1)

- No products, storefront, cart, checkout or payments yet (Phases 2–3)
- No staff invite screen yet — the invite table exists; the flow lands in Phase 4
- No platform-admin pages yet; the admin role exists in the database
- Rate-limit counters are kept in memory, so they reset when the server restarts
- Not deployed anywhere yet (Phase 6)

## Testing

See [docs/manual-test-checklist.md](docs/manual-test-checklist.md) to verify everything by hand.
