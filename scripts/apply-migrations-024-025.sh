#!/usr/bin/env bash
# Apply gift-card purchase tracking + store_settings migrations only.
# Usage:
#   DATABASE_URL='postgresql://...' ./scripts/apply-migrations-024-025.sh
# Or source .env first from repo root.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Export your Neon connection string and re-run." >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/database/migrations/024_gift_card_purchase_tracking.sql" \
  -f "$ROOT/database/migrations/025_store_settings.sql"

echo "Applied 024_gift_card_purchase_tracking and 025_store_settings."
