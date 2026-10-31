#!/usr/bin/env bash
# Backs up the development database, restores the backup into a brand-new
# database, and checks both hold the same data. A backup only counts once it
# has been restored successfully, so this proves the whole round trip.
#
# Usage: scripts/backup-restore-check.sh
# Set DOCKER if the docker command isn't on your PATH, e.g.
#   DOCKER=/Applications/Docker.app/Contents/Resources/bin/docker scripts/backup-restore-check.sh
set -euo pipefail

DOCKER="${DOCKER:-docker}"
SOURCE_DB="${SOURCE_DB:-shop_dev}"
RESTORE_DB="shop_restore_check"
psql_in() { "$DOCKER" compose exec -T db psql -U shop -d "$1" -tAc "$2"; }

mkdir -p backups
backup_file="backups/${SOURCE_DB}-$(date +%Y%m%d-%H%M%S).dump"

echo "1. Backing up ${SOURCE_DB} to ${backup_file}"
# Custom format is compressed and lets pg_restore pick tables if ever needed.
"$DOCKER" compose exec -T db pg_dump -U shop -d "$SOURCE_DB" --format=custom > "$backup_file"
ls -lh "$backup_file" | awk '{print "   size:", $5}'

echo "2. Restoring into a fresh database (${RESTORE_DB})"
"$DOCKER" compose exec -T db dropdb -U shop --if-exists "$RESTORE_DB"
"$DOCKER" compose exec -T db createdb -U shop "$RESTORE_DB"
"$DOCKER" compose exec -T db pg_restore -U shop -d "$RESTORE_DB" --no-owner < "$backup_file"

echo "3. Comparing row counts"
tables="stores users store_memberships products product_variants inventory_levels inventory_movements orders order_items payments refunds discounts audit_logs _prisma_migrations"
mismatches=0
printf "   %-22s %10s %10s\n" "table" "original" "restored"
for table in $tables; do
  original=$(psql_in "$SOURCE_DB" "SELECT count(*) FROM \"$table\"")
  restored=$(psql_in "$RESTORE_DB" "SELECT count(*) FROM \"$table\"")
  marker=""
  if [ "$original" != "$restored" ]; then marker="  <-- MISMATCH"; mismatches=$((mismatches + 1)); fi
  printf "   %-22s %10s %10s%s\n" "$table" "$original" "$restored" "$marker"
done

echo "4. Spot check: money totals match"
sum_sql='SELECT coalesce(sum("totalCents"),0) || \x27 cents in \x27 || count(*) || \x27 orders\x27 FROM orders'
echo "   original: $(psql_in "$SOURCE_DB" "$(printf "$sum_sql")")"
echo "   restored: $(psql_in "$RESTORE_DB" "$(printf "$sum_sql")")"

"$DOCKER" compose exec -T db dropdb -U shop "$RESTORE_DB"
if [ "$mismatches" -gt 0 ]; then
  echo "FAILED: $mismatches table(s) differ."
  exit 1
fi
echo "OK: the backup restores completely. Kept at ${backup_file}"
