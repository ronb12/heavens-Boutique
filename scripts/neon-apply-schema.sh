#!/usr/bin/env bash
# Apply Neon DDL: full schema only on empty DB; otherwise run migrations only.
# Requires: NEON_API_KEY (or neonctl auth), psql, optional NEON_PROJECT_ID / NEON_BRANCH.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${NEON_PROJECT_ID:-withered-fog-14874911}"
BRANCH="${NEON_BRANCH:-production}"

echo "Neon project: $PROJECT_ID  branch: $BRANCH"
CONN="$(npx neonctl@latest connection-string "$BRANCH" --project-id "$PROJECT_ID" --pooled --no-color)"

has_users="$(psql "$CONN" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1" | tr -d '[:space:]')"

apply_migrations() {
  shopt -s nullglob
  for f in "$ROOT/database/migrations"/*.sql; do
    echo "Applying migration: $f"
    psql "$CONN" -v ON_ERROR_STOP=1 -f "$f"
  done
  shopt -u nullglob
}

if [ "$has_users" = "1" ]; then
  echo "Database already initialized (public.users exists). Skipping database/schema.sql."
  echo "Running SQL migrations under database/migrations/ only."
  apply_migrations
else
  echo "Empty database — applying database/schema.sql, then migrations."
  psql "$CONN" -v ON_ERROR_STOP=1 -f "$ROOT/database/schema.sql"
  apply_migrations
fi

echo "Neon DDL step finished."
