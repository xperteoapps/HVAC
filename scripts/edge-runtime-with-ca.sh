#!/usr/bin/env bash
# Odtwarza kontener Edge Runtime z `supabase start` z zaufanym CA (środowiska z proxy TLS,
# np. sesje Claude Code w chmurze). Dodatkowe sekrety funkcji: plik supabase/functions/.env.local
# (KEY=VALUE, nie commitować). Użycie: CA_BUNDLE=/root/.ccr/ca-bundle.crt scripts/edge-runtime-with-ca.sh
set -euo pipefail
NAME="${EDGE_CONTAINER:-supabase_edge_runtime_hvac}"
CA="${CA_BUNDLE:-/root/.ccr/ca-bundle.crt}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/edge-runtime-ca"
mkdir -p "$WORK"

IMAGE=$(docker inspect "$NAME" --format '{{.Config.Image}}')
NETWORK=$(docker inspect "$NAME" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')
WORKDIR=$(docker inspect "$NAME" --format "{{.Config.WorkingDir}}")
WORKDIR="${WORKDIR:-$ROOT}"
docker cp "$NAME:/root/index.ts" "$WORK/main.ts"
docker inspect "$NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^PATH=' | grep -v '^$' > "$WORK/env"
if [ -f "$ROOT/supabase/functions/.env.local" ]; then grep -v '^#' "$ROOT/supabase/functions/.env.local" | grep -v '^$' >> "$WORK/env"; fi
cp "$CA" "$WORK/ca.crt"

docker rm -f "$NAME" >/dev/null
docker run -d --name "$NAME" --network "$NETWORK" --network-alias edge_runtime -w "$WORKDIR" \
  --env-file "$WORK/env" -e DENO_CERT=/certs/ca.crt -e DENO_TLS_CA_STORE=mozilla,system -e SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
  -v "$WORK/ca.crt:/certs/ca.crt:ro" -v "$WORK/ca.crt:/etc/ssl/certs/ca-certificates.crt:ro" -v "$WORK/main.ts:/root/index.ts:ro" \
  -v "${NAME}:/root/.cache/deno" -v "$ROOT/supabase/functions:$ROOT/supabase/functions:ro" \
  --entrypoint sh "$IMAGE" -c "exec edge-runtime start --main-service=/root --port=8081 --policy=per_worker" >/dev/null
echo "Edge Runtime odtworzony z CA ($CA) w sieci $NETWORK"
