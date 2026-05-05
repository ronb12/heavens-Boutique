#!/usr/bin/env bash
# Deploy the Next.js storefront from web/ (link that directory to your storefront Vercel project).
# Prerequisites: `cd web && npx vercel link`, or VERCEL_WEB_PROJECT_ID + VERCEL_ORG_ID in env.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/web"

echo ">>> npm ci (web/)…"
npm ci

echo ">>> vercel deploy --prod (storefront project)…"
exec npx --yes vercel@50 deploy --prod --yes --non-interactive "$@"
