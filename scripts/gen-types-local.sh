#!/usr/bin/env bash
# Generuje src/integrations/supabase/types.ts z LOKALNEJ bazy Postgres (bez Dockera).
# Użycie: po zmianie migracji, gdy nie masz jeszcze projektu Supabase:
#   PG_URL=postgresql://postgres@127.0.0.1:5499/postgres?sslmode=disable ./scripts/gen-types-local.sh
# Docelowo (projekt zdalny): npm run db:types
set -euo pipefail
PG_URL="${PG_URL:-postgresql://postgres@127.0.0.1:5499/postgres?sslmode=disable}"
npx --yes supabase@latest gen types typescript --db-url "$PG_URL" --schema public > src/integrations/supabase/types.ts
echo "OK → src/integrations/supabase/types.ts"
