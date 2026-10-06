#!/usr/bin/env bash
# Odtwarza schemat na lokalnym Postgresie (odpowiednik `supabase db reset` bez Dockera).
# Wymaga działającego Postgresa oraz shim schematu auth/vault (scripts/db-local-shim.sql).
set -euo pipefail
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5499}" PGUSER="${PGUSER:-postgres}"
cd "$(dirname "$0")/.."
psql -q -v ON_ERROR_STOP=1 -c "drop schema if exists public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role; alter default privileges in schema public grant all on tables to anon, authenticated, service_role; alter default privileges in schema public grant all on functions to anon, authenticated, service_role; alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;" 2>&1 | grep -v NOTICE || true
psql -q -v ON_ERROR_STOP=1 -f scripts/db-local-shim.sql 2>&1 | grep -v NOTICE || true
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -vE "NOTICE|^DETAIL|^$|schedule_supplier_sync|^-+$|^\(1 row\)$|^\s*$" || true
  echo "APPLIED $f"
done
psql -q -v ON_ERROR_STOP=1 -f supabase/seed.sql 2>&1 | grep -vE "NOTICE|recalc_all_products|^-+$|^\s*[0-9]+$|^\(1 row\)$|^$" || true
echo "SEED OK"
