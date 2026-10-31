# Backup and restore

A backup is only worth something if it restores. This page shows how to make one, how to restore it, and the result of a real rehearsal.

## What needs backing up

| Data | Where it lives | How it's backed up |
| --- | --- | --- |
| Everything in the database: stores, products, orders, customers, staff, audit log | Postgres | `pg_dump` (below). In Phase 6 the hosting provider's daily backups and point-in-time recovery are switched on as well. |
| Uploaded images | `STORAGE_DIR` on disk locally; an S3-compatible bucket from Phase 6 | Copy the folder locally. In the cloud, turn on bucket versioning so deleted or overwritten files can be recovered. |
| Secrets (`.env`) | Your machine; the platform's secret store from Phase 6 | Never in backups or git. Keep them in a password manager. |

Backup files contain customer names, emails and addresses. `backups/` is git-ignored; store copies only somewhere encrypted with limited access.

## Rehearsal script

```bash
DOCKER=/Applications/Docker.app/Contents/Resources/bin/docker scripts/backup-restore-check.sh
```

It backs up `shop_dev`, restores the file into a brand-new database, compares the row counts of the important tables and the money totals, then deletes the temporary database. It stops with an error if anything differs.

## Restoring for real

1. Stop the app, so nothing writes while you restore.
2. Create an empty database and restore into it:

   ```bash
   docker compose exec -T db createdb -U shop shop_restored
   ```

   ```bash
   docker compose exec -T db pg_restore -U shop -d shop_restored --no-owner < backups/<file>.dump
   ```

3. Point `DATABASE_URL` at `shop_restored`, start the app and check a few stores and orders.
4. Run `npx prisma migrate status`: it should say the schema is up to date. If the backup is older than the code, `npx prisma migrate deploy` applies the newer migrations.

Restoring into a new database (instead of over the old one) means you can always go back if the backup turns out to be the wrong one.

## Rehearsal result (2026-10-30)

Run against the local development database:

```text
1. Backing up shop_dev to backups/shop_dev-20261030-231053.dump
   size: 105K
2. Restoring into a fresh database (shop_restore_check)
NOTICE:  database "shop_restore_check" does not exist, skipping
3. Comparing row counts
   table                    original   restored
   stores                          3          3
   users                           7          7
   store_memberships               5          5
   products                       22         22
   product_variants               79         79
   inventory_levels               79         79
   inventory_movements            78         78
   orders                          2          2
   order_items                     3          3
   payments                        2          2
   refunds                         1          1
   discounts                       1          1
   audit_logs                     67         67
   _prisma_migrations              8          8
4. Spot check: money totals match
   original: 29037 cents in 2 orders
   restored: 29037 cents in 2 orders
OK: the backup restores completely. Kept at backups/shop_dev-20261030-231053.dump
```

Every table matched, and the order totals are identical to the cent.
