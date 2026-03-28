# Heaven’s Boutique

SwiftUI iOS app + Vercel (Node) API + Neon Postgres. Repo: [github.com/ronb12/heavens-Boutique](https://github.com/ronb12/heavens-Boutique).

## Wire-up checklist

### 1. Database (Neon)

1. Create a Neon project and copy the **connection string**.
2. In the Neon SQL editor (or `psql`), run `database/schema.sql`.
3. Promote your owner account: register in the app, then run  
   `UPDATE users SET role = 'admin' WHERE email = 'your@email.com';`

### 2. API (Vercel)

1. In [Vercel](https://vercel.com) → New Project → import this GitHub repo.
2. Set **Root Directory** to `backend` (required).
3. Add **Environment Variables** (see `backend/.env.example`):

   | Variable | Purpose |
   |----------|---------|
   | `DATABASE_URL` | Neon Postgres URL |
   | `JWT_SECRET` | Long random string |
   | `STRIPE_SECRET_KEY` | Stripe secret key |
   | `STRIPE_WEBHOOK_SECRET` | From Stripe webhook |
   | `CLOUDINARY_CLOUD_NAME` | Product image URLs |
   | `ADMIN_EMAILS` | Comma-separated emails → `admin` on register |
   | `CORS_ORIGIN` | Optional; default `*` |
   | `CRON_SECRET` | Optional; `Authorization: Bearer …` for cron |

4. Deploy. Your API base URL will be `https://<project>.vercel.app/api`.

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
