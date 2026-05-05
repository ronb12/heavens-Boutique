/**
 * Visit storefront routes in a headless browser and report console errors + uncaught exceptions.
 *
 * Usage:
 *   BASE_URL=https://your-store.vercel.app node scripts/check-console-pages.cjs
 *
 * Authenticated admin crawl (after saving session):
 *   npm run save:playwright-auth
 *   AUTH_STATE_PATH=./playwright-admin-auth.json npm run check:console
 *
 * Default auth file: web/playwright-admin-auth.json (same dir as package.json).
 * Chrome for Testing: `npx playwright install chromium` (optional: PLAYWRIGHT_BROWSERS_PATH).
 * If browsers live at repo sibling `../playwright-browsers`, it is detected automatically.
 * Or set PLAYWRIGHT_CHANNEL=chrome to use system Google Chrome instead.
 *
 * Sign in in a visible browser, then crawl in the same session:
 *   INTERACTIVE_AUTH=1 npm run check:console
 *   npm run check:console:headed
 *
 * Automated login (no prompt; headless OK). Uses the same form as /login.
 * Do not commit credentials — use shell env or a local .env file you never commit:
 *   E2E_ADMIN_EMAIL=you@example.com E2E_ADMIN_PASSWORD='…' npm run check:console
 * Aliases: E2E_LOGIN_EMAIL, E2E_LOGIN_PASSWORD
 * Skipped if playwright-admin-auth.json exists (storage wins). Disabled when only INTERACTIVE_AUTH
 * is set without E2E_* (manual sign-in flow).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

/** Unbuffered progress (Cursor / non-TTY stderr often hides plain write until exit). */
function errLine(msg) {
  const line = msg.endsWith("\n") ? msg : `${msg}\n`;
  try {
    fs.writeSync(2, line);
  } catch {
    process.stderr.write(line);
  }
}

const INTERACTIVE_AUTH =
  process.env.INTERACTIVE_AUTH === "1" || /^true$/i.test(String(process.env.INTERACTIVE_AUTH || ""));

function e2eCredentials() {
  const email =
    String(process.env.E2E_ADMIN_EMAIL || process.env.E2E_LOGIN_EMAIL || "").trim() || "";
  const password = String(process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_LOGIN_PASSWORD ?? "");
  return { email, password };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} email
 * @param {string} password
 */
async function performE2ELogin(page, email, password) {
  const loginUrl = `${BASE}/login?next=${encodeURIComponent("/admin")}`;
  await page.goto(loginUrl, { waitUntil: "load", timeout: 120000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL(
      (u) => {
        try {
          return u.pathname.startsWith("/admin");
        } catch {
          return false;
        }
      },
      { timeout: 60000 },
    );
  } catch (e) {
    const hint = await page
      .locator(".text-rose-700")
      .first()
      .textContent()
      .catch(() => null);
    throw new Error(
      hint ? `E2E login failed: ${hint.trim()}` : `E2E login failed (still not on /admin): ${e.message}`,
    );
  }
}

/** .../Heaven's Boutique/web/scripts → sibling .../playwright-browsers on the same volume */
function ensurePlaywrightBrowsersPath() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return;
  const sibling = path.join(__dirname, "..", "..", "..", "playwright-browsers");
  if (fs.existsSync(sibling)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = sibling;
  }
}

const BASE = (process.env.BASE_URL || "https://heavens-boutique-web-steel.vercel.app").replace(/\/+$/, "");
const DEFAULT_AUTH_STATE = path.join(__dirname, "..", "playwright-admin-auth.json");

const STATIC_PATHS = [
  "/",
  "/account",
  "/account/addresses",
  "/account/profile",
  "/account/payment-methods",
  "/admin",
  "/admin/analytics",
  "/admin/content-pages",
  "/admin/customers",
  "/admin/discounts",
  "/admin/easypost-settings",
  "/admin/gift-cards",
  "/admin/homepage",
  "/admin/inventory",
  "/admin/inventory-audit",
  "/admin/orders",
  "/admin/orders/new",
  "/admin/products",
  "/admin/products/new",
  "/admin/products-csv",
  "/admin/promo-analytics",
  "/admin/purchase-orders",
  "/admin/returns",
  "/admin/staff",
  "/admin/stripe-settings",
  "/blog",
  "/cart",
  "/checkout",
  "/checkout/success",
  "/gift-cards",
  "/login",
  "/register",
  "/messages",
  "/orders",
  "/returns",
  "/shop",
  "/wishlist",
];

async function fetchJson(path) {
  try {
    const r = await fetch(`${BASE}${path}`, { redirect: "follow" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function collectDynamicPaths() {
  const extra = [];
  const products = await fetchJson("/api/products?limit=5");
  const list = products?.products ?? [];
  for (const p of Array.isArray(list) ? list : []) {
    const id = p?.id;
    if (id) extra.push(`/shop/${id}`);
  }
  const pagesPayload = await fetchJson("/api/pages");
  const posts = pagesPayload?.posts ?? [];
  for (const post of Array.isArray(posts) ? posts : []) {
    if (post?.slug) extra.push(`/blog/${encodeURIComponent(post.slug)}`);
  }
  const cmsPages = pagesPayload?.pages ?? [];
  for (const row of Array.isArray(cmsPages) ? cmsPages : []) {
    if (row?.slug) extra.push(`/pages/${encodeURIComponent(row.slug)}`);
  }
  return [...new Set(extra)];
}

/** Logged-out admin pages call /api/admin/* and get 401 — Chrome logs that as a console error. */
function isExpectedUnauthorizedNoise(text) {
  return /status of 401|status of 403|\b401\b.*\b(unauthor|forbidden)/i.test(text);
}

function question(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });
    rl.question(promptText, () => {
      rl.close();
      try {
        if (process.stdin.isTTY) process.stdin.resume();
      } catch {
        /* ignore */
      }
      resolve();
    });
  });
}

/**
 * @param {import('playwright').Page | null} reusePage If set, navigate this page (interactive headed crawl — one tab).
 */
async function checkPath(context, routePath, reusePage = null) {
  const ownPage = reusePage == null;
  const page = reusePage ?? (await context.newPage());
  const errors = [];
  const warnings = [];

  const onConsole = (msg) => {
    const t = msg.type();
    const text = msg.text();
    if (t === "error") errors.push(text);
    if (t === "warning" && /aria-hidden|violat|accessib/i.test(text)) warnings.push(text);
  };
  const onPageError = (err) => {
    errors.push(err.message || String(err));
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  let status = 0;
  try {
    const resp = await page.goto(`${BASE}${routePath}`, {
      waitUntil: "load",
      timeout: 90000,
    });
    status = resp?.status() ?? 0;
    await new Promise((r) => setTimeout(r, 800));
  } catch (e) {
    errors.push(`navigation: ${e.message || e}`);
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    if (ownPage) await page.close().catch(() => {});
  }

  const unexpectedErrors = errors.filter((e) => !isExpectedUnauthorizedNoise(e));
  return { path: routePath, status, errors, unexpectedErrors, warnings };
}

async function launchBrowser() {
  const fromEnv = process.env.PLAYWRIGHT_CHANNEL?.trim();
  const candidates = [fromEnv, "chrome", "msedge", "chrome-beta"].filter(Boolean);
  const tried = new Set();
  for (const channel of candidates) {
    if (tried.has(channel)) continue;
    tried.add(channel);
    try {
      return await chromium.launch({ headless: true, channel });
    } catch {
      /* try next */
    }
  }
  return chromium.launch({ headless: true });
}

async function launchBrowserHeaded() {
  // Prefer Playwright’s Chromium (Chrome for Testing) — system Chrome can hang or mismatch CDP.
  const useSystemFirst = /^true$/i.test(String(process.env.PLAYWRIGHT_HEADED_USE_SYSTEM || ""));
  if (!useSystemFirst) {
    try {
      return await chromium.launch({ headless: false });
    } catch (e) {
      errLine(`Headed bundled Chromium failed (${e.message || e}); trying system browser…`);
    }
  }
  const fromEnv = process.env.PLAYWRIGHT_CHANNEL?.trim();
  const candidates = [fromEnv, "chrome", "msedge", "chrome-beta"].filter(Boolean);
  const tried = new Set();
  for (const channel of candidates) {
    if (tried.has(channel)) continue;
    tried.add(channel);
    try {
      return await chromium.launch({ headless: false, channel });
    } catch {
      /* next */
    }
  }
  return chromium.launch({ headless: false });
}

async function main() {
  ensurePlaywrightBrowsersPath();
  const authPath = path.resolve(process.env.AUTH_STATE_PATH || DEFAULT_AUTH_STATE);
  const hasAuthFile = fs.existsSync(authPath);
  const { email: e2eEmail, password: e2ePassword } = e2eCredentials();
  const useE2ELogin = Boolean(e2eEmail && e2ePassword.length > 0 && !hasAuthFile);
  const useStorageState = hasAuthFile && !INTERACTIVE_AUTH && !useE2ELogin;
  const useInteractivePrompt = INTERACTIVE_AUTH && !useE2ELogin;

  errLine(`BASE_URL=${BASE}`);
  if (useE2ELogin) {
    errLine("Auth: E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD (automated login)\n");
  } else if (useInteractivePrompt) {
    errLine("INTERACTIVE_AUTH=1 — browser opens for sign-in; press Enter when admin has loaded.\n");
  } else if (useStorageState) {
    errLine(`AUTH_STATE=${authPath} (loaded)\n`);
  } else {
    errLine(
      `No auth — admin may log 401. Options: E2E_* env, ${path.basename(authPath)}, or INTERACTIVE_AUTH=1\n`,
    );
  }

  const dynamic = await collectDynamicPaths();
  const paths = [...new Set([...STATIC_PATHS, ...dynamic])].sort();

  const browser = useInteractivePrompt ? await launchBrowserHeaded() : await launchBrowser();
  const context = await browser.newContext(useStorageState ? { storageState: authPath } : {});

  /** @type {import('playwright').Page | null} */
  let crawlPage = null;
  if (useE2ELogin) {
    crawlPage = await context.newPage();
    errLine("Signing in via /login …");
    await performE2ELogin(crawlPage, e2eEmail, e2ePassword);
    errLine(`Signed in. Crawling ${paths.length} URLs in one tab…\n`);
  } else if (useInteractivePrompt) {
    crawlPage = await context.newPage();
    const loginUrl = `${BASE}/login?next=${encodeURIComponent("/admin")}`;
    await crawlPage.goto(loginUrl, { waitUntil: "load", timeout: 120000 });
    errLine("→ Sign in in the browser until you see the admin dashboard.");
    await question("→ Press Enter here when done… ");
    errLine("Starting crawl in this same tab (you should see the URL change for each route)…");
    await new Promise((r) => setImmediate(r));
    errLine(`Crawling ${paths.length} URLs (a few minutes)…\n`);
  }
  const rows = [];
  try {
    for (const routePath of paths) {
      errLine(`${routePath} …`);
      const row = await checkPath(context, routePath, crawlPage);
      rows.push(row);
      const bad = row.unexpectedErrors.length + row.warnings.length;
      const noise = row.errors.length - row.unexpectedErrors.length;
      if (bad) errLine(`  → issues ${bad}`);
      else if (noise) errLine(`  → ok (ignored ${noise} auth fetch noise)`);
      else errLine("  → ok");
    }
  } finally {
    if (crawlPage) await crawlPage.close().catch(() => {});
    await context.close();
    await browser.close();
  }

  const withUnexpected = rows.filter((r) => r.unexpectedErrors.length);
  const withAuthNoise = rows.filter((r) => r.errors.length > r.unexpectedErrors.length);
  const withWarns = rows.filter((r) => r.warnings.length);

  errLine("\n=== Summary ===\n");
  errLine(`Pages checked: ${rows.length}`);
  errLine(`With unexpected console errors (JS / non-auth): ${withUnexpected.length}`);
  errLine(`With only 401/403 fetch noise: ${withAuthNoise.length}`);
  errLine(`With a11y-related warnings: ${withWarns.length}\n`);

  for (const r of rows) {
    if (!r.unexpectedErrors.length && !r.warnings.length) continue;
    errLine(`--- ${r.path} (HTTP ${r.status}) ---`);
    for (const e of r.unexpectedErrors) errLine(`  ERROR: ${e}`);
    for (const w of r.warnings) errLine(`  WARN: ${w}`);
    errLine("");
  }

  if (withUnexpected.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
