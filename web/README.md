This [Next.js](https://nextjs.org) app is the **storefront** for Heaven’s Boutique (shop, account, checkout UI, web admin shell).

## Local development

```bash
cd web
cp .env.example .env.local
# Set BACKEND_PROXY_ORIGIN or NEXT_PUBLIC_API_BASE_URL so /api reaches your API (see below).
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production (Vercel) — environment variables

Set these on the **Next.js** Vercel project (the one with **Root Directory** `web` or that deploys this folder).

| Variable | Required? | Purpose |
|----------|-----------|---------|
| **`BACKEND_PROXY_ORIGIN`** | **Yes** (unless using row below) | Required when the storefront and API are **different hosts**. Set to the API origin **without** a path or trailing slash (e.g. `https://heavens-boutique-api.vercel.app`). `next.config.ts` rewrites `/api/*` → `{BACKEND_PROXY_ORIGIN}/api/*`. If the API and Next app share one deployment, omit this. |
| **`NEXT_PUBLIC_API_BASE_URL`** | Alternative to proxy | Full API base including `/api`, e.g. `https://heavens-boutique.vercel.app/api`. Use when you don’t use `BACKEND_PROXY_ORIGIN`. |

If neither is set, the homepage and shop cannot load catalog data from the API.

### Admin, Stripe, Neon (API project — not this folder)

These belong on the **Node API** deployment (repo root / `backend`), not on the Next project:

- **`ADMIN_EMAILS`** — owner/operator emails allowed as admin.
- **`DATABASE_URL`** — Neon Postgres.
- **`STRIPE_SECRET_KEY`**, **`STRIPE_WEBHOOK_SECRET`**, **`JWT_SECRET`**, blob tokens, etc.

See the **repository root `README.md`** and **`backend/.env.example`** for the full API checklist.

## Deploy

```bash
npm run deploy
```

Or from the monorepo root: `./scripts/deploy-vercel-web.sh` (see root README).
