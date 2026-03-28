# Heaven’s Boutique

SwiftUI iOS app + Vercel (Node) API + Neon Postgres. Repo: [github.com/ronb12/heavens-Boutique](https://github.com/ronb12/heavens-Boutique).

## Wire-up checklist

### 1. Database (Neon)

1. Create a Neon project and copy the **connection string**.
2. In the Neon SQL editor (or `psql`), run `database/schema.sql`.
3. **Admin account:** Set Vercel (and local `.env`) **`ADMIN_EMAILS`** to `ronellbradley@gmail.com` so that email gets **admin** on register. To create or reset the owner in Postgres (password `password1234`, bcrypt 10 rounds — **change this password after first login**):

   ```bash
   cd backend && cp .env.example .env   # add DATABASE_URL, JWT_SECRET, etc.
   npm ci && npm run seed:admin
   ```

   Override defaults: `ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='yourpass' npm run seed:admin`

### 2. API (Vercel)

1. In [Vercel](https://vercel.com) → New Project → import this GitHub repo.
2. **Root Directory** (pick one — keep it consistent with how you deploy):
   - **`.` (repo root)** — recommended for **GitHub Actions** in this repo: the workflow prepares `api/`, `lib/`, and `public/` at the repo root and root **`vercel.json`** runs the same copy on Vercel’s builders. Set this in Vercel → Project → Settings → General → **Root Directory** = empty or `.`.
   - **`backend`** — fine for **manual** `vercel deploy` from `backend/` only. If you use this, do not rely on the root bundle; the live app is `backend/api`.
3. Add **Environment Variables** (see `backend/.env.example`):

   | Variable | Purpose |
   |----------|---------|
   | `DATABASE_URL` | Neon Postgres URL |
   | `JWT_SECRET` | Long random string |
   | `STRIPE_SECRET_KEY` | Stripe secret key |
   | `STRIPE_WEBHOOK_SECRET` | From Stripe webhook |
   | `CLOUDINARY_CLOUD_NAME` | Product image URLs |
   | `ADMIN_EMAILS` | e.g. `ronellbradley@gmail.com` — comma-separated; those emails get `admin` on register |
   | `CORS_ORIGIN` | Optional; default `*` |
   | `CRON_SECRET` | Optional; `Authorization: Bearer …` for cron |

4. Deploy. The site root **`/`** is the **marketing** page (hero, story, app CTA, contact). The **REST API** lives at **`https://heavens-boutique.vercel.app/api`** (already wired for this repo’s Vercel project).

**If the browser or app shows `404 NOT_FOUND` for `/` or `/api/...`:** In Vercel → Project → Settings → General, set **Root Directory** to the **repository root** (leave the field empty), redeploy, and confirm `GET /api/products` returns JSON. A common cause is **Root Directory = `backend`** while the deployment expects `api/` at the project root, or a prior root bundle that was excluded from upload by `.gitignore` (fixed in this repo for CI).

### Neon CLI — re-apply schema

From the repo root (after `neonctl auth`):

```bash
export NEON_PROJECT_ID=withered-fog-14874911   # default in script; optional override
bash scripts/neon-apply-schema.sh
```

Or from `backend/`: `npm run db:apply`

### Vercel CLI — deploy API

From `backend/` (after `vercel link`):

```bash
npm run deploy
# or: npx vercel deploy --prod --yes
```

### 3. Stripe

1. [Dashboard](https://dashboard.stripe.com) → Developers → Webhooks → Add endpoint:  
   `https://<project>.vercel.app/api/webhooks/stripe`  
   Events: at least `payment_intent.succeeded`.
2. Copy the **signing secret** into `STRIPE_WEBHOOK_SECRET`.
3. Use **test** keys until go-live.

### 4. iOS app

1. Open `ios/HeavensBoutique.xcodeproj` (or run `cd ios && xcodegen generate` after editing `project.yml`).
2. Set **API_BASE_URL** and **STRIPE_PUBLISHABLE_KEY** in `ios/HeavensBoutique/Info.plist` (or override via Xcode target **Build Settings** / `project.yml` `info.properties`) to match your Vercel URL and Stripe publishable key.
3. Add a real **App Icon** in `Assets.xcassets` before App Store submission.

### 5. Optional: FCM / Apple Pay

- **FCM:** Set `FCM_PROJECT_ID` and a short-lived `FCM_ACCESS_TOKEN` (or replace with a token refresh worker). Register device tokens via `PATCH /api/users/me` with `fcmToken`.
- **Apple Pay:** Add the Apple Pay capability, merchant ID, and `PaymentSheet.Configuration.applePay` in `CheckoutView.swift`.

## Local backend

```bash
cd backend && cp .env.example .env
# Edit .env, then:
npm install
npx vercel dev
```

## CI

GitHub Actions runs on `main`: installs backend deps and `node --check` on `api/**/*.js` and `lib/*.js`.

## Deploy (GitHub Actions → Vercel + Neon)

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

| Trigger | What happens |
|--------|----------------|
| **Push to `main`** | Prepares the **repo-root** Vercel bundle (`api/`, `lib/`, `public/`) and **deploys to Vercel production**. Set the Vercel project **Root Directory** to **repository root** (`.`). If `database/**` or `scripts/neon-apply-schema.sh` changed, runs **`database/schema.sql` on Neon** first. After deploy, **smoke-tests** `GET /api/products` (override base URL with repo variable `VERCEL_SMOKE_BASE` if needed). |
| **Workflow dispatch** | Same Vercel deploy; set **Apply database** = `yes` to force a Neon schema run. |

### GitHub Actions → Vercel (required)

Under **GitHub → Settings → Secrets and variables → Actions**:

| Name | Tab | Value |
|------|-----|--------|
| `VERCEL_TOKEN` | **Secrets** (required) | [Create a token](https://vercel.com/account/tokens) |
| `VERCEL_SCOPE` | **Variables** (often optional) | First segment of the Vercel dashboard URL: `vercel.com/<scope>/<project>`. For a **personal** account this is usually your Vercel username; for a **team**, the **team slug** (not `team_…`). If unset, the workflow uses **`GITHUB_REPOSITORY_OWNER`** (e.g. `ronb12` for `ronb12/heavens-Boutique`). |
| `VERCEL_PROJECT_SLUG` | **Variables** (optional) | Vercel project slug (URL segment). If unset, the workflow lowercases the repo name from **`GITHUB_REPOSITORY`** (e.g. `heavens-boutique` for `ronb12/heavens-Boutique`). |

**Default path:** `vercel link --yes --scope … --project …` then **`vercel deploy --prod`** so CI gets a valid `.vercel/project.json`. Using **`vercel deploy --project` alone** is unreliable in non-interactive runs.

**Optional:** If secrets **`VERCEL_ORG_ID`** and **`VERCEL_PROJECT_ID`** are **both** set (from Vercel → Project → Settings → General), the workflow skips `link` and deploys using those IDs only. If that fails, remove one or both secrets to fall back to the default slug + `link` path.

### Repository secrets (optional / other)

| Secret | Where to get it |
|--------|------------------|
| `NEON_API_KEY` | [Neon Console → Account → API keys](https://console.neon.tech/app/settings/api-keys) |
| `VERCEL_ORG_ID` | Optional; use with `VERCEL_PROJECT_ID` for ID-based deploy (org/team id, often `team_…`). |
| `VERCEL_PROJECT_ID` | Optional; project id `prj_…` on the same Vercel settings page. |

**Deploy error “no credentials” / “pass --token”:** The `VERCEL_TOKEN` repository secret is missing, empty, or the workflow ran in a context where secrets are unavailable (e.g. pull request from a fork). Create a token at the link above and add **`VERCEL_TOKEN`** under **Actions** secrets for this repo (not only **Dependabot** or **Codespaces** unless you deploy from there).

**Deploy error “Project not found” / wrong scope:** Set **`VERCEL_SCOPE`** to the first segment of `vercel.com/<scope>/<project>`. For an **org-owned** GitHub repo, `GITHUB_REPOSITORY_OWNER` is the **org**, which may not match your Vercel username—set **`VERCEL_SCOPE`** explicitly.

**iOS: “HTTP 404” on Register / Login:** The app calls `https://<project>.vercel.app/api/auth/register`. A 404 means Vercel is not serving `/api/*` (deploy failed, wrong **Root Directory**, or routes missing). Confirm in a browser or Terminal: `curl -sS -o /dev/null -w "%{http_code}" -X POST https://heavens-boutique.vercel.app/api/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.co","password":"password1234"}'` — expect **201** or **409**, not **404**. Fix the deploy first; **`API_BASE_URL`** in the app should stay `https://…vercel.app/api` (the app also auto-appends `/api` if you omit it).

### Repository variables (optional)

| Variable | Purpose |
|----------|---------|
| `VERCEL_SCOPE` | Vercel dashboard URL scope (see table above). |
| `VERCEL_PROJECT_SLUG` | Vercel project name slug (default `heavens-boutique`). |
| `NEON_PROJECT_ID` | Neon project ID (defaults to `withered-fog-14874911` in the workflow if unset) |
| `VERCEL_SMOKE_BASE` | Override production URL for the deploy smoke test (default `https://heavens-boutique.vercel.app`) |

**Note:** Re-running the full `schema.sql` against a database that already has those tables will **fail** (duplicate `CREATE TABLE`). Use incremental SQL or reset a dev branch for full replays. Routine app deploys still update Vercel even when the Neon step is skipped.

## App Store readiness (technical)

The iOS target includes items Apple commonly checks in review, but **final approval depends on App Store Connect metadata, legal pages, and manual review.**

| Area | Status in this repo |
|------|---------------------|
| **Account deletion (5.1.1(v))** | In-app **Delete account** on Profile; `DELETE /api/users/me` removes the user and cascaded data. |
| **Export compliance** | `ITSAppUsesNonExemptEncryption` = **NO** (HTTPS / standard TLS only). |
| **Privacy manifest** | `PrivacyInfo.xcprivacy` declares **UserDefaults** (`CA92.1`) for local cart persistence. Stripe SPM bundles its own manifests. |
| **App icon** | Single **1024×1024** asset (placeholder pink tile). Replace with branded art before release. |
| **Permissions strings** | Camera / photo library keys **removed** until chat photo picking is implemented (avoids “unused permission” rejections). |
| **Push** | `remote-notification` background mode **removed** until APNs + entitlements are configured. |
| **Payments** | Physical goods via **Stripe** is allowed; use a **live** `STRIPE_PUBLISHABLE_KEY` for production builds. State in App Store review notes that purchases are for physical products, not digital IAP. |
| **Signing** | Set your **Development Team** in Xcode for device/archive builds. |
| **You still must provide in App Store Connect** | Privacy policy URL, support URL, age rating, screenshots, description, and accurate **Privacy Nutrition Labels** (cross-check with Stripe + your API). |
