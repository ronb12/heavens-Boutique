/**
 * Clicks visible, non-destructive buttons across key routes (smoke: no uncaught click failures).
 * Skips: sign out, delete account, Stripe pay, promo delete, dialogs dismissed via dismiss().
 *
 *   cd web && BASE_URL=https://your-site.vercel.app \
 *     E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
 *     npm run test:e2e:buttons
 *
 * Without credentials: only public routes. With credentials: also /account/* and /admin/*.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

function errLine(msg) {
  const line = msg.endsWith("\n") ? msg : `${msg}\n`;
  try {
    fs.writeSync(2, line);
  } catch {
    process.stderr.write(line);
  }
}

function ensurePlaywrightBrowsersPath() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return;
  const sibling = path.join(__dirname, "..", "..", "..", "playwright-browsers");
  if (fs.existsSync(sibling)) process.env.PLAYWRIGHT_BROWSERS_PATH = sibling;
}

const BASE = (process.env.BASE_URL || "https://heavens-boutique-web-steel.vercel.app").replace(/\/+$/, "");

const PUBLIC_PATHS = [
  "/",
  "/shop",
  "/cart",
  "/wishlist",
  "/gift-cards",
  "/login",
  "/register",
  "/returns",
  "/blog",
  "/messages",
  "/checkout",
  "/checkout/success",
  "/pages/about",
  "/pages/shipping",
  "/pages/returns",
];

const AUTH_PATHS = [
  "/account",
  "/account/profile",
  "/account/addresses",
  "/account/payment-methods",
  "/orders",
  "/admin",
  "/admin/analytics",
  "/admin/products",
  "/admin/products/new",
  "/admin/products-csv",
  "/admin/orders",
  "/admin/orders/new",
  "/admin/customers",
  "/admin/discounts",
  "/admin/inventory",
  "/admin/inventory-audit",
  "/admin/purchase-orders",
  "/admin/gift-cards",
  "/admin/homepage",
  "/admin/content-pages",
  "/admin/stripe-settings",
  "/admin/easypost-settings",
  "/admin/promo-analytics",
  "/admin/returns",
  "/admin/staff",
];

function creds() {
  const email = String(process.env.E2E_ADMIN_EMAIL || process.env.E2E_LOGIN_EMAIL || "").trim();
  const password = String(process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_LOGIN_PASSWORD ?? "");
  return { email, password };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    for (const channel of [process.env.PLAYWRIGHT_CHANNEL?.trim(), "chrome", "msedge"].filter(Boolean)) {
      try {
        return await chromium.launch({ headless: true, channel });
      } catch {
        /* next */
      }
    }
    return chromium.launch({ headless: true });
  }
}

async function fetchJson(p) {
  try {
    const r = await fetch(`${BASE}${p}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function extraPaths() {
  const out = [];
  const products = await fetchJson("/api/products?limit=3");
  for (const p of products?.products ?? []) {
    if (p?.id) out.push(`/shop/${p.id}`);
  }
  const pages = await fetchJson("/api/pages");
  for (const post of pages?.posts ?? []) {
    if (post?.slug) out.push(`/blog/${encodeURIComponent(post.slug)}`);
  }
  return out;
}

async function performLogin(page, email, password, nextPath) {
  const loginUrl = `${BASE}/login?next=${encodeURIComponent(nextPath)}`;
  await page.goto(loginUrl, { waitUntil: "load", timeout: 120000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  const admin = nextPath.startsWith("/admin");
  await page.waitForURL(
    (u) => (admin ? u.pathname.startsWith("/admin") : u.pathname.startsWith(nextPath.replace(/\/$/, ""))),
    { timeout: 90000 },
  );
}

function shouldSkipClick(textRaw, ariaRaw) {
  const text = String(textRaw || "").replace(/\s+/g, " ").trim();
  const aria = String(ariaRaw || "").trim();
  const s = `${text} ${aria}`.toLowerCase();
  if (!text && !aria) return true;
  if (/sign out|log out|delete account|pay with stripe|delete code|cannot be undone|danger zone/.test(s)) return true;
  if (/^delete$/i.test(text)) return true;
  if (/^disable$/i.test(text) && /promo|code/i.test(s)) return true;
  return false;
}

async function exercisePageButtons(page, routePath, stats, failures) {
  const selector =
    "button:not([disabled]), [role='button']:not([disabled]), input[type='submit']:not([disabled]), input[type='button']:not([disabled])";
  const loc = page.locator(selector);
  const count = await loc.count();
  let clicked = 0;
  let skipped = 0;

  for (let i = 0; i < count; i++) {
    const el = loc.nth(i);
    const vis = await el.isVisible().catch(() => false);
    if (!vis) continue;
    const text = ((await el.textContent().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    const aria = (await el.getAttribute("aria-label").catch(() => "")) || "";
    if (shouldSkipClick(text, aria)) {
      skipped++;
      continue;
    }
    try {
      await el.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await el.click({ timeout: 10000 });
      clicked++;
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      failures.push({
        route: routePath,
        target: (text || aria).slice(0, 100),
        error: e.message || String(e),
      });
    }
  }

  stats.pages++;
  stats.clicked += clicked;
  stats.skipped += skipped;
  stats.elements += count;
}

async function main() {
  ensurePlaywrightBrowsersPath();
  const { email, password } = creds();
  const dynamic = await extraPaths();
  const pathsPublic = [...new Set([...PUBLIC_PATHS, ...dynamic])].sort();

  errLine(`BASE_URL=${BASE}`);
  errLine(`Button smoke — public routes: ${pathsPublic.length}`);

  const stats = { pages: 0, clicked: 0, skipped: 0, elements: 0 };
  const failures = [];

  const browser = await launchBrowser();

  const runPaths = async (context, paths, label) => {
    errLine(`\n--- ${label} (${paths.length} pages) ---`);
    for (const p of paths) {
      const routePath = p;
      errLine(`${routePath} …`);
      const page = await context.newPage();
      page.on("dialog", (d) => d.dismiss().catch(() => {}));
      page.on("pageerror", (err) => {
        failures.push({ route: routePath, target: "[uncaught]", error: err.message.slice(0, 300) });
      });
      try {
        await page.goto(`${BASE}${routePath}`, { waitUntil: "load", timeout: 90000 });
        await exercisePageButtons(page, routePath, stats, failures);
      } catch (e) {
        failures.push({ route: routePath, target: "[navigation]", error: e.message || String(e) });
      } finally {
        await page.close();
      }
    }
  };

  try {
    const ctx1 = await browser.newContext();
    try {
      await runPaths(ctx1, pathsPublic, "Public (no auth)");
    } finally {
      await ctx1.close();
    }

    if (email && password) {
      errLine("\n--- Authenticated session ---");
      const ctx2 = await browser.newContext();
      const loginPage = await ctx2.newPage();
      try {
        const wantsAdmin = AUTH_PATHS.some((p) => p.startsWith("/admin"));
        await performLogin(loginPage, email, password, wantsAdmin ? "/admin" : "/account");
      } catch (e) {
        await ctx2.close();
        throw new Error(`Login failed: ${e.message || e}`);
      } finally {
        await loginPage.close();
      }
      try {
        await runPaths(ctx2, AUTH_PATHS, "Signed-in (account + admin)");
      } finally {
        await ctx2.close();
      }
    } else {
      errLine("\n(skip signed-in routes — set E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD)");
    }
  } finally {
    await browser.close();
  }

  errLine("\n=== Summary ===");
  errLine(`Pages scanned: ${stats.pages}`);
  errLine(`Button-like controls seen: ${stats.elements}`);
  errLine(`Clicks attempted (non-skipped): ${stats.clicked}`);
  errLine(`Skipped (destructive / blocked): ${stats.skipped}`);
  errLine(`Issues: ${failures.length}`);

  if (failures.length) {
    for (const f of failures.slice(0, 40)) {
      errLine(`  ${f.route} — ${f.target}: ${f.error}`);
    }
    if (failures.length > 40) errLine(`  … and ${failures.length - 40} more`);
    process.exitCode = 1;
  } else {
    errLine("All exercised buttons clicked without errors.");
  }
}

main().catch((e) => {
  errLine(String(e.message || e));
  process.exit(1);
});
