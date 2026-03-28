#!/usr/bin/env bash
# Apply database/schema.sql to Neon using neonctl + psql.
# Requires: neonctl auth, psql, NEON_PROJECT_ID (optional override).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${NEON_PROJECT_ID:-withered-fog-14874911}"
BRANCH="${NEON_BRANCH:-production}"

echo "Neon project: $PROJECT_ID  branch: $BRANCH"
CONN="$(npx neonctl@latest connection-string "$BRANCH" --project-id "$PROJECT_ID" --pooled --no-color)"
psql "$CONN" -v ON_ERROR_STOP=1 -f "$ROOT/database/schema.sql"
echo "Schema applied."
