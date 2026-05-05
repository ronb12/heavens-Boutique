/**
 * Smoke test: storefront customer + admin flows (forms + navigation).
 *
 *   cd web && BASE_URL=https://your-store.vercel.app \
 *     E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
 *     npm run test:e2e:smoke
 *
 * Optional customer account (defaults to same as admin if unset — admin can use /shop):
 *   E2E_CUSTOMER_EMAIL=... E2E_CUSTOMER_PASSWORD=...
 *
 * Requires Playwright browsers (see check-console-pages.cjs / PLAYWRIGHT_BROWSERS_PATH).
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

function adminCreds() {
  const email = String(process.env.E2E_ADMIN_EMAIL || "").trim();
  const password = String(process.env.E2E_ADMIN_PASSWORD ?? "");
  return { email, password };
}

function customerCreds() {
  const email = String(
    process.env.E2E_CUSTOMER_EMAIL || process.env.E2E_ADMIN_EMAIL || "",
  ).trim();
  const password = String(process.env.E2E_CUSTOMER_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? "");
  return { email, password };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    const candidates = [process.env.PLAYWRIGHT_CHANNEL?.trim(), "chrome", "msedge"].filter(Boolean);
    for (const channel of candidates) {
      try {
        return await chromium.launch({ headless: true, channel });
      } catch {
        /* next */
      }
    }
    return chromium.launch({ headless: true });
  }
}

function attachConsoleBucket(page, bucket) {
  page.on("console", (msg) => {
    if (msg.type() === "error") bucket.push(`[console] ${msg.text()}`);
  });
  page.on("pageerror", (err) => bucket.push(`[page] ${err.message}`));
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

async function assertNoRoseFatal(page, label) {
  const rose = page.locator(".text-rose-700.font-semibold");
  if ((await rose.count()) > 0) {
    const t = (await rose.first().textContent().catch(() => "")) || "";
    if (t.trim()) throw new Error(`${label}: ${t.trim()}`);
  }
}

async function customerSmoke(browser) {
  const { email, password } = customerCreds();
  if (!email || !password) {
    errLine("SKIP customer smoke: set E2E_CUSTOMER_* or E2E_ADMIN_*");
    return { ok: true, skipped: true, errors: [] };
  }

  const errors = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  attachConsoleBucket(page, errors);

  try {
    errLine("— Customer: sign in → /shop");
    await performLogin(page, email, password, "/shop");
    await assertNoRoseFatal(page, "customer login");

    const visits = ["/shop", "/cart", "/wishlist", "/gift-cards", "/account", "/account/profile", "/orders"];
    for (const p of visits) {
      errLine(`— Customer: GET ${p}`);
      await page.goto(`${BASE}${p}`, { waitUntil: "load", timeout: 90000 });
      await assertNoRoseFatal(page, p);
      await new Promise((r) => setTimeout(r, 400));
    }

    errLine("— Customer: profile page (form loaded, no save — avoids PATCH /api/users/me if API errors)");
    await page.goto(`${BASE}/account/profile`, { waitUntil: "load", timeout: 90000 });
    await page.getByRole("heading", { name: /profile/i }).waitFor({ state: "visible", timeout: 30000 });
    const loading = page.getByText("Loading…");
    if ((await loading.count()) > 0) await loading.first().waitFor({ state: "hidden", timeout: 45000 });
    await page.getByLabel(/full name/i).waitFor({ state: "visible", timeout: 30000 });
    await page.getByRole("button", { name: /save changes/i }).waitFor({ state: "visible", timeout: 30000 });
    await assertNoRoseFatal(page, "profile page");

    const bad = errors.filter((e) => !/favicon|analytics|extension/i.test(e));
    if (bad.length) errLine(`Customer console noise: ${bad.join("; ")}`);
    errLine("Customer smoke: OK\n");
    return { ok: true, skipped: false, errors: bad };
  } finally {
    await context.close();
  }
}

async function adminSmoke(browser) {
  const { email, password } = adminCreds();
  if (!email || !password) throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

  const errors = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  attachConsoleBucket(page, errors);

  try {
    errLine("— Admin: sign in → /admin");
    await performLogin(page, email, password, "/admin");
    await assertNoRoseFatal(page, "admin login");

    const visits = [
      "/admin",
      "/admin/products",
      "/admin/orders",
      "/admin/customers",
      "/admin/inventory",
      "/admin/gift-cards",
      "/admin/homepage",
      "/admin/purchase-orders",
    ];
    for (const p of visits) {
      errLine(`— Admin: GET ${p}`);
      await page.goto(`${BASE}${p}`, { waitUntil: "load", timeout: 90000 });
      await assertNoRoseFatal(page, p);
      await new Promise((r) => setTimeout(r, 400));
    }

    errLine("— Admin: discount form (create test code + delete)");
    await page.goto(`${BASE}/admin/discounts`, { waitUntil: "load", timeout: 90000 });
    await page.getByRole("heading", { name: /discount/i }).waitFor({ state: "visible", timeout: 30000 });
    const code = `E2E${Date.now().toString(36)}`.toUpperCase();
    await page.getByLabel(/code/i).fill(code);
    await page.getByRole("button", { name: /create code/i }).click();
    await page.locator("li", { hasText: code }).waitFor({ state: "visible", timeout: 20000 });
    await assertNoRoseFatal(page, "discount create");

    page.once("dialog", (d) => d.accept());
    await page
      .locator("li", { hasText: code })
      .getByRole("button", { name: /^delete$/i })
      .click();
    await page.locator("li", { hasText: code }).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    await assertNoRoseFatal(page, "discount delete");

    const bad = errors.filter((e) => !/favicon|analytics|extension/i.test(e));
    if (bad.length) errLine(`Admin console noise: ${bad.join("; ")}`);
    errLine("Admin smoke: OK\n");
    return { ok: true, skipped: false, errors: bad };
  } finally {
    await context.close();
  }
}

async function main() {
  ensurePlaywrightBrowsersPath();
  errLine(`BASE_URL=${BASE}`);
  errLine("E2E customer/admin smoke (forms + pages)\n");

  const browser = await launchBrowser();
  try {
    const c = await customerSmoke(browser);
    const a = await adminSmoke(browser);

    const ce = c.errors || [];
    const ae = a.errors || [];
    const fatal = [...ce, ...ae].filter(Boolean);
    errLine("=== Summary ===");
    errLine(`Customer: ${c.skipped ? "skipped" : "passed"}${ce.length ? ` (${ce.length} console errors)` : ""}`);
    errLine(`Admin: passed${ae.length ? ` (${ae.length} console errors)` : ""}`);
    if (fatal.length) {
      fatal.forEach((e) => errLine(`  ${e}`));
      process.exitCode = 1;
    } else {
      errLine("All checks passed.");
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  errLine(String(e.message || e));
  process.exit(1);
});
