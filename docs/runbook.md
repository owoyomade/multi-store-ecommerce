# Runbook

How the staging site is put together, how to change it safely, and what to do when something breaks. Keep this next to you when deploying.

## What runs where

| Part | Service | Notes |
| --- | --- | --- |
| The app (pages, server actions, API routes) | Vercel (Hobby plan) | Builds from the `main` branch on GitHub. Each push to another branch gets its own preview URL. |
| Database | Neon Postgres (free plan) | The app uses the **pooled** address (`DATABASE_URL`); migrations use the **direct** one (`DIRECT_URL`). Pauses when idle, so the first request after a quiet spell is about a second slower. |
| Uploaded images | Cloudflare R2 bucket (private) | The app reads and writes it with an access key; shoppers get images through `/media`, never straight from the bucket. |
| Email | Brevo SMTP (free plan) | Verification, password reset, invites, order and shipping emails. |
| Payments | Stripe **test mode** | Webhook endpoint: `https://<staging-url>/api/webhooks/stripe`. |
| Code and checks | GitHub + GitHub Actions | CI runs lint, typecheck, formatting, all tests, the build and the browser tests. |

## Settings (environment variables)

All secrets live in **Vercel → Project → Settings → Environment Variables**, never in git or chat. Mark every secret as *Sensitive*, so it can't be read back from the dashboard.

| Name | Example / where it comes from |
| --- | --- |
| `DATABASE_URL` | Neon → Connect → **pooled** connection string |
| `DIRECT_URL` | Neon → Connect → turn pooling off → direct connection string |
| `APP_URL` | `https://<project>.vercel.app` (no trailing slash) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` (a new value, not the local one) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Brevo → SMTP & API → SMTP |
| `EMAIL_FROM` | `Storefront Studio <the-address-you-verified-in-Brevo>` |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Cloudflare → R2 → bucket, and an API token with Object Read & Write on that bucket only |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (test mode, `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → the staging endpoint → signing secret |
| `ERROR_REPORT_URL` | Optional: an error tracker's ingest URL |

Never set `E2E_FAKE_PAYMENTS` on a hosted environment. The app refuses to start the fake provider unless it runs on localhost.

## Deploying a change

1. Make the change on a branch and push it. CI runs, and Vercel builds a preview URL.
2. Check the preview. If the change includes a database migration, read "Migrations" below first.
3. Merge to `main`. Vercel builds and promotes the new version to the staging URL automatically.
4. Open `https://<staging-url>/api/health`. It should say `{"status":"ok"}`.

## Migrations

Apply schema changes **before** the code that needs them goes live, from your own machine:

```bash
DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" npx prisma migrate deploy
```

Write migrations so the previous version of the app still works afterwards (add columns, don't rename or drop them in the same release). Then a rollback of the code never needs a rollback of the database.

## Rolling back

The fastest fix for a bad release is to put the previous version back. It takes seconds and needs no rebuild.

- **Dashboard:** Vercel → Project → Deployments → find the last good deployment → ⋯ → **Instant Rollback**.
- **Command line:**

  ```bash
  vercel rollback <deployment-url-or-id>
  ```

Then fix the problem on a branch and deploy again normally. After a rollback, Vercel stops auto-promoting new `main` builds until you promote one yourself (Deployments → ⋯ → Promote), so you can check the fix first.

## Logs

- **App logs:** Vercel → Project → Logs, or `vercel logs <deployment-url>`. Server errors are single JSON lines with `"level":"error"`; filter for `request.failed`, `webhook.processing_failed`, `refund.provider_error` or `checkout.provider_error`.
- **Emails:** Brevo → Transactional → Logs.
- **Payments and webhooks:** Stripe → Developers → Webhooks → the endpoint → recent deliveries (it shows each response the app gave).

## When something breaks

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Every page errors right after a deploy | A missing or wrong environment variable (the app checks them at startup) | Read the log line: it names the variable. Fix it in Vercel, then redeploy. Roll back meanwhile. |
| "Can't reach database server" | Neon paused or the URL changed | Open the Neon dashboard (it wakes the database); check `DATABASE_URL` is the pooled address. |
| Orders stuck on "Confirming your payment…" | Stripe webhook failing | Stripe → Webhooks → the endpoint → look at the failed delivery. A `400 Invalid signature` means `STRIPE_WEBHOOK_SECRET` doesn't match the endpoint's secret. Stripe retries for 3 days, so fixing the secret lets old events through. |
| Images missing | R2 credentials or bucket name wrong | Look for storage errors in the logs; check the `S3_*` variables and that the token can read and write that bucket. |
| No emails arriving | SMTP login wrong, or the sender address isn't verified in Brevo | Brevo → Transactional → Logs. |
| Sign-in says "too many attempts" for everyone | Rate limits keyed on one shared address | Check the logs show different client IPs; Vercel sets `x-forwarded-for` for each visitor. |

## Rotating a secret

1. Create the new value at the provider (e.g. a new R2 token, a new Brevo SMTP key, `openssl rand -base64 32` for the auth secret).
2. Replace it in Vercel's environment variables.
3. Redeploy (Deployments → ⋯ → Redeploy), check the site, then delete the old value at the provider.

Rotating `BETTER_AUTH_SECRET` signs everyone out, which is the point if it leaked.

## Backups

Neon keeps a restore window (point-in-time restore) on every plan. Before risky changes, also take your own copy with the direct URL:

```bash
pg_dump "<direct url>" --format=custom --file=backups/staging-$(date +%Y%m%d).dump
```

See [backup-restore.md](backup-restore.md) for restoring and the tested rehearsal.

## Costs and limits

Everything above runs on free plans. Vercel's Hobby plan is for non-commercial use: a portfolio demo is fine, but real merchants need the Pro plan. Neon's free plan includes a limited amount of compute time each month and pauses when idle. Check each dashboard's usage page monthly.

## Deployment record

Filled in as deploys and rollbacks happen.
