#!/usr/bin/env bash
# Deploy the Node API bundle from the repo root (same layout as GitHub Actions + root vercel.json).
# Prerequisites: `vercel login`, then from repo root: `npx vercel link` (or set VERCEL_ORG_ID / VERCEL_PROJECT_ID).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo ">>> Preparing Vercel bundle at repo root (api/, lib/, public/)…"
cp backend/package.json backend/package-lock.json .
npm ci
rm -rf api lib public
cp -R backend/api api
cp -R backend/lib lib
mkdir -p public
cp -R backend/public/. public/

echo ">>> vercel deploy --prod (API project)…"
# Root repo has many files (web/, ios/…); tgz upload avoids the 15k per-file list limit.
exec npx --yes vercel@50 deploy --prod --yes --non-interactive --archive=tgz "$@"
