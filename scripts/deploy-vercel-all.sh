#!/usr/bin/env bash
# API first, then Next.js storefront (same as a full GitHub Actions push when VERCEL_WEB_PROJECT_SLUG is set).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/deploy-vercel-api.sh" "$@"
"$SCRIPT_DIR/deploy-vercel-web.sh" "$@"
