# Heaven’s Boutique

> Curated women’s fashion in your pocket—**SwiftUI** on iOS, a **Node** API on **Vercel**, and **Neon Postgres**. Boutique polish: soft pink and gold UI, secure **Stripe** checkout, and admin tools for catalog and orders.

**[heavens-boutique.vercel.app](https://heavens-boutique.vercel.app)** (marketing + API) · **[Source](https://github.com/ronb12/heavens-Boutique)**

## About

**Heaven’s Boutique** is an end-to-end retail stack for a small fashion brand: shoppers use the **iOS app** to browse featured collections, manage cart and wishlist, and complete checkout; operators use **in-app admin** flows for catalog and order management. A **serverless REST API** powers the app; the same Vercel project serves the **public marketing site** (story, values, App Store CTA, contact, legal pages).

| Layer | What runs here |
|--------|----------------|
| **iOS** | SwiftUI app (`ios/`) — shop, cart, checkout (Stripe), profile, messages, notifications |
| **API** | Node ESM serverless handlers (`backend/api/`) — auth, products, orders, webhooks, cron |
| **Web** | Static marketing + legal (`backend/public/`) deployed beside the API |
| **Data** | PostgreSQL on Neon — schema and migrations under `database/` |
| **Delivery** | GitHub Actions on `main` → Vercel production ([`deploy.yml`](.github/workflows/deploy.yml)) |

### Product highlights

- **Shopping** — Featured products, categories, product detail, variants, cart, and wishlist  
- **Payments** — Stripe PaymentSheet; webhook-driven order flow; manual refund workflow documented below  
- **Accounts** — Register / login (JWT), guest checkout, account deletion for App Store compliance  
- **Admin** — Catalog and order management (access via long-press on the boutique name on Home)  
- **Engagement** — In-app notifications and conversations (API-backed)  
- **Brand** — Marketing homepage matches the app’s luxury boutique aesthetic (light-first design)

### Repository layout

| Path | Purpose |
|------|---------|
| `ios/` | Xcode / XcodeGen project for the HeavensBoutique app |
| `backend/` | API handlers, shared `lib/`, npm deps, local `vercel dev` |
| `database/` | `schema.sql`, ordered `migrations/` |
| `.github/workflows/` | Deploy to Vercel (+ optional Neon apply) |

---

## Wire-up checklist

### 1. Database (Neon)

1. Create a Neon project and copy the **connection string**.
2. In the Neon SQL editor (or `psql`), run `database/schema.sql`. If you already have a live database from an older schema, apply incremental migrations under `database/migrations/` in order (e.g. **`002_orders_guest_checkout.sql`** for guest checkout; **`003_orders_refunded_status.sql`** adds `refunded` to `orders.status`).
3. **Admin account:** Set Vercel (and local `.env`) **`ADMIN_EMAILS`** to your admin email (comma-separated for several). That email gets **admin** on **register**, and if you already registered as a customer, the next **login** promotes you to **admin** automatically. To create or reset the owner in Postgres, run **`npm run seed:admin`** (defaults: **`heavenbowie0913@gmail.com`** / **`password1234`** — bcrypt 10 rounds; **change this password after first login**):

   ```bash
   cd backend && cp .env.example .env   # add DATABASE_URL, JWT_SECRET, etc.
   npm ci && npm run seed:admin
   ```

   Override defaults: `ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='yourpass' npm run seed:admin`

   **Demo data (shop, orders, cart, wishlist, promos, conversations, notifications):** after `seed:admin`, run `npm run seed:sample`. This **does not delete any customer accounts**; it upserts the sample user by email and only replaces rows tied to fixed demo IDs (plus safe catalog deletes when no real orders reference those SKUs). Sample login: **`customer@sample.heavensboutique.app`** / **`SamplePass123`** (override with `SAMPLE_CUSTOMER_EMAIL` / `SAMPLE_CUSTOMER_PASSWORD`).

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
   | `BLOB_READ_WRITE_TOKEN` | **Recommended (free on Vercel Hobby):** Vercel Blob store token — enables admin photo upload **without** Cloudinary (`POST /api/admin/upload` prefers Blob when set) |
   | `CLOUDINARY_CLOUD_NAME` | If you use Cloudinary IDs / delivery URLs: **same** as iOS `CLOUDINARY_CLOUD_NAME` in `ios/project.yml` for pasted-ID previews |
   | `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Only if Blob is **not** set — admin uploads go to Cloudinary |
   | `CLOUDINARY_UPLOAD_FOLDER` | Optional; default `heavens-boutique/products` |
   | `ADMIN_EMAILS` | e.g. `you@domain.com` — comma-separated; those emails get `admin` on register **or** on next login if they were `customer` |
   | `CORS_ORIGIN` | Optional; default `*` |
   | `CRON_SECRET` | Optional; `Authorization: Bearer …` for cron |
   | `FCM_PROJECT_ID` | Firebase / GCP project ID for **server-side** push (`sendPushToToken`); omit → pushes skipped |
   | `FCM_ACCESS_TOKEN` | Short-lived OAuth2 access token for FCM HTTP v1 (service account); omit → pushes skipped |
   | `PROFIT_GUARD_CARD_PERCENT` | Optional; default `0.029` — estimated card fee rate in admin **profit guard** (`products` save) |
   | `PROFIT_GUARD_CARD_FIXED_CENTS` | Optional; default `30` ($0.30) fixed fee per assumed charge; set `0` with percent `0` to match legacy “price ≥ cost” only |

4. Deploy. The site root **`/`** is the **marketing** page (hero, story, app CTA, contact). The **REST API** lives at **`https://heavens-boutique.vercel.app/api`** (already wired for this repo’s Vercel project).

**If the browser or app shows `404 NOT_FOUND` for `/` or `/api/...`:** In Vercel → Project → Settings → General, set **Root Directory** to the **repository root** (leave the field empty), redeploy, and confirm `GET /api/products` returns JSON. A common cause is **Root Directory = `backend`** while the deployment expects `api/` at the project root, or a prior root bundle that was excluded from upload by `.gitignore` (fixed in this repo for CI).

### Neon CLI — schema and migrations

`scripts/neon-apply-schema.sh` (used by CI when `database/**` changes):

- If **`public.users` is missing** (empty DB), it runs **`database/schema.sql`** then every **`database/migrations/*.sql`** in order.
- If the DB **already exists**, it **skips** the full schema file and only runs **migrations** (avoids `relation "users" already exists` on deploy).

From the repo root (after `neonctl auth` or with `NEON_API_KEY`):

```bash
export NEON_PROJECT_ID=withered-fog-14874911   # default in script; optional override
bash scripts/neon-apply-schema.sh
```

Or from `backend/`: `npm run db:apply`

For new tables or columns on a live database, add a file under **`database/migrations/`** rather than editing `schema.sql` only.

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

### Refunds (manual, recommended flow)

Stripe does **not** automatically set order status in this app when you issue a refund in the Dashboard.

1. In [Stripe Dashboard](https://dashboard.stripe.com) → **Payments**, open the payment (search by amount, customer email, or copy the **PaymentIntent** id from the admin order screen in the app).
2. Issue a **full or partial refund** as appropriate.
3. In the iOS app, open **Admin** (long-press the boutique name on Home) → **Orders** → tap the order → set **Status** to **Refunded** (or **Cancelled** if you did not capture payment) and tap **Save**.

Registered customers get an in-app **Order update** notification when status changes. **Guest checkout** orders have no app user, so there is no in-app notification; they rely on Stripe’s receipt email.

**Inventory:** Adjust variant stock yourself (admin catalog / database) if you returned items to sellable inventory.

### 4. iOS app

1. Open `ios/HeavensBoutique.xcodeproj` (or run `cd ios && xcodegen generate` after editing `project.yml` or adding Swift files).
2. Set **API_BASE_URL** and **STRIPE_PUBLISHABLE_KEY** in `ios/HeavensBoutique/Info.plist` (or override via Xcode target **Build Settings** / `project.yml` `info.properties`) to match your Vercel URL and Stripe publishable key.
3. Add a real **App Icon** in `Assets.xcassets` before App Store submission.
4. **Stripe / Apple Pay:** Exercise checkout on a **physical device** with a test card and (when configured) Apple Pay; simulators do not fully match wallet behavior.
5. **UI tests:** Scheme **HeavensBoutique** includes **HeavensBoutiqueUITests** (smoke launch / welcome). Run **Product → Test** in Xcode.
6. **Push notifications (FCM):** The app uses the **Firebase iOS SDK** (`FirebaseCore` + `FirebaseMessaging`) only to obtain an FCM registration token and receive APNs; the **server** still sends pushes via `backend/lib/fcm.js` (HTTP v1) using `FCM_PROJECT_ID` + `FCM_ACCESS_TOKEN` on Vercel.
   - This repo’s iOS app is registered under Firebase / GCP project **`taskpilot-ronb12`** (shared with TaskPilot) as **Heavens Boutique iOS** (`com.heavensboutique.app`). **`GoogleService-Info.plist`** lives at **`ios/HeavensBoutique/GoogleService-Info.plist`** (gitignored; regenerate with `firebase apps:sdkconfig IOS <AppId> --project taskpilot-ronb12 -o …` if needed). Set **`FCM_PROJECT_ID=taskpilot-ronb12`** on Vercel so server FCM v1 matches. The app skips `FirebaseApp.configure()` if the plist is missing or still looks like a template.
   - Firebase → **Cloud Messaging** → upload your **APNs Authentication Key** from Apple Developer (or APNs certificates). Xcode target **Push Notifications** is enabled via **`Entitlements-Debug.plist`** / **`Entitlements-Release.plist`** in `project.yml`.
   - After **sign-in**, the app requests notification permission, registers for remote notifications, and **`PATCH`es `/users/me`** with **`fcmToken`**. **Sign-out** clears `fcm_token` on the server before dropping the JWT.
7. **App Store Connect — Privacy Nutrition Labels:** Align answers with what the app and API actually collect (account email/name, order and payment data via Stripe, **FCM device token** (Firebase SDK), in-app messages/notifications). Cross-check `backend/public/privacy.html` and third-party SDKs (**Stripe**, **Firebase** for push). Backend data lives on **Neon**; the app talks to your **Vercel** API.

### 5. Optional: Apple Pay

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
| `VERCEL_SCOPE` | **Variables** | **Leave unset** for a **personal / hobby** Vercel account (the CLI rejects `--scope` with your username). Set only for a **team**: use the **team slug** from `vercel.com/<team-slug>/<project>` (not `team_…`). |
| `VERCEL_PROJECT_SLUG` | **Variables** (optional) | Vercel project slug (URL segment). If unset, the workflow lowercases the repo name from **`GITHUB_REPOSITORY`** (e.g. `heavens-boutique` for `ronb12/heavens-Boutique`). |

**Default path:** `vercel link --yes` (with `--scope` only if **`VERCEL_SCOPE`** is set) **`--project …`**, then **`vercel deploy --prod`**, so CI gets a valid `.vercel/project.json`.

**Optional:** If secrets **`VERCEL_ORG_ID`** and **`VERCEL_PROJECT_ID`** are **both** set (from Vercel → Project → Settings → General), the workflow skips `link` and deploys using those IDs only. **Do not set only one** — a lone `VERCEL_ORG_ID` makes `vercel deploy` fail after `link`. Remove both to use the default `link` path.

### Repository secrets (optional / other)

| Secret | Where to get it |
|--------|------------------|
| `NEON_API_KEY` | [Neon Console → Account → API keys](https://console.neon.tech/app/settings/api-keys) |
| `VERCEL_ORG_ID` | Optional; use with `VERCEL_PROJECT_ID` for ID-based deploy (org/team id, often `team_…`). |
| `VERCEL_PROJECT_ID` | Optional; project id `prj_…` on the same Vercel settings page. |

**Deploy error “no credentials” / “pass --token”:** The `VERCEL_TOKEN` repository secret is missing, empty, or the workflow ran in a context where secrets are unavailable (e.g. pull request from a fork). Create a token at the link above and add **`VERCEL_TOKEN`** under **Actions** secrets for this repo (not only **Dependabot** or **Codespaces** unless you deploy from there).

**Deploy error “You cannot set your Personal Account as the scope”:** Clear **`VERCEL_SCOPE`** (personal accounts must not pass `--scope`). **Team** projects: set **`VERCEL_SCOPE`** to the team slug only.

**Deploy error “Project not found”:** Confirm **`VERCEL_PROJECT_SLUG`** matches the Vercel project name. For **team** projects, set **`VERCEL_SCOPE`** to the team slug.

**iOS: “HTTP 404” on Register / Login:** The app calls `https://<project>.vercel.app/api/auth/register`. A 404 means Vercel is not serving `/api/*` (deploy failed, wrong **Root Directory**, or routes missing). Confirm in a browser or Terminal: `curl -sS -o /dev/null -w "%{http_code}" -X POST https://heavens-boutique.vercel.app/api/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.co","password":"password1234"}'` — expect **201** or **409**, not **404**. Fix the deploy first; **`API_BASE_URL`** in the app should stay `https://…vercel.app/api` (the app also auto-appends `/api` if you omit it).

### Repository variables (optional)

| Variable | Purpose |
|----------|---------|
| `VERCEL_SCOPE` | Team slug only when the project lives under a Vercel **team**; omit for **personal** accounts. |
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
| **Push** | `UIBackgroundModes` includes **`remote-notification`** for FCM; you still need APNs key, push capability, and user permission for production pushes. |
| **Payments** | Physical goods via **Stripe** is allowed; use a **live** `STRIPE_PUBLISHABLE_KEY` for production builds. State in App Store review notes that purchases are for physical products, not digital IAP. |
| **Signing** | Set your **Development Team** in Xcode for device/archive builds. |
| **You still must provide in App Store Connect** | Privacy policy URL, support URL, age rating, screenshots, description, and accurate **Privacy Nutrition Labels** (cross-check with Stripe + your API). |
