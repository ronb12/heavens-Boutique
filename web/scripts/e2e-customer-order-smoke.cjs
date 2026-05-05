/**
 * Creates a one-off product (admin API), then walks the storefront checkout to embedded Stripe Payment Element.
 *
 *   cd web && BASE_URL=https://your-store.vercel.app \
 *     E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
 *     npm run test:e2e:order
 *
 * Customer account defaults to admin creds if E2E_CUSTOMER_* unset.
 * Keeps the product if E2E_KEEP_PRODUCT=1 (otherwise deletes after the run).
 *
 * Success = payments/intent succeeds and Pay button is visible (full card entry is manual / test card).
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

async function fetchLogin(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`API login ${r.status}: ${text.slice(0, 500)}`);
  const j = JSON.parse(text);
  if (!j.token) throw new Error("No token in login response");
  return j.token;
}

async function createE2EProduct(adminToken) {
  const slug = `e2e-order-${Date.now()}`;
  const body = {
    name: `E2E Checkout Sample (${slug.slice(-8)})`,
    slug,
    description: "Automated test product — safe to delete.",
    category: "general",
    priceCents: 1999,
    variants: [{ size: "S", stock: 100, sku: `E2E-${Date.now()}` }],
  };
  const r = await fetch(`${BASE}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Create product ${r.status}: ${text.slice(0, 500)}`);
  const j = JSON.parse(text);
  const p = j.product;
  if (!p?.id) throw new Error("No product id in response");
  return { productId: p.id, slug: p.slug || slug };
}

async function deleteE2EProduct(adminToken, productId) {
  const r = await fetch(`${BASE}/api/products/${productId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!r.ok && r.status !== 404) {
    const t = await r.text().catch(() => "");
    errLine(`WARN: could not delete product ${productId}: HTTP ${r.status} ${t.slice(0, 200)}`);
  }
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

async function main() {
  ensurePlaywrightBrowsersPath();
  const { email: ae, password: ap } = adminCreds();
  const { email: ce, password: cp } = customerCreds();
  if (!ae || !ap) throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  if (!ce || !cp) throw new Error("Set customer creds (E2E_CUSTOMER_* or same as admin)");

  errLine(`BASE_URL=${BASE}`);
  errLine("Step 1: Admin API — create sample product");
  const adminToken = await fetchLogin(ae, ap);
  const { productId, slug } = await createE2EProduct(adminToken);
  errLine(`  Created product ${productId} (slug ${slug})\n`);

  errLine("Step 2: Browser — customer login, add to cart, checkout → embedded Stripe Payment Element");
  const browser = await launchBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await performLogin(page, ce, cp, "/shop");
    await page.goto(`${BASE}/shop/${productId}`, { waitUntil: "load", timeout: 120000 });
    await page.getByRole("button", { name: "Add to cart" }).click();
    await new Promise((r) => setTimeout(r, 500));

    await page.goto(`${BASE}/checkout`, { waitUntil: "load", timeout: 120000 });
    await page.getByText("Shipping & order", { exact: false }).waitFor({ state: "visible", timeout: 30000 });
    await assertNoRoseFatal(page, "checkout load");

    await page.getByLabel(/full name/i).fill("E2E Ship To");
    await page.getByLabel(/street address/i).fill("123 E2E Test Lane");
    // Checkout has several <select>s: country, (US) state, shipping tier — use stable order.
    const mainSelects = page.locator("main select");
    await mainSelects.nth(0).selectOption("US");
    await page.getByLabel(/^city$/i).fill("Austin");
    await mainSelects.nth(1).selectOption("TX");
    await page.getByLabel(/zip/i).fill("78701");

    await assertNoRoseFatal(page, "checkout form");

    const respP = page.waitForResponse(
      (r) => r.url().includes("/api/payments/intent") && r.request().method() === "POST",
      { timeout: 90000 },
    );
    await page.getByRole("button", { name: /continue to secure payment/i }).click();
    const resp = await respP;
    const respText = await resp.text();
    if (!resp.ok()) {
      const code = typeof resp.status === "function" ? resp.status() : resp.status;
      if (/payments are not configured|stripe keys/i.test(respText)) {
        errLine(`\nPARTIAL PASS (payments/intent HTTP ${code})`);
        errLine("  ✓ Admin API created a sample product");
        errLine("  ✓ Customer login, product page, add to cart, checkout address form, Continue to secure payment");
        errLine("  ✗ Stripe is not configured on the API — set Stripe keys on Vercel (API project) to complete payment.");
        let apiErr = respText.slice(0, 240);
        try {
          apiErr = JSON.parse(respText).error || apiErr;
        } catch {
          /* ignore */
        }
        errLine(`    ${apiErr}\n`);
        return;
      }
      throw new Error(`payments/intent HTTP ${code}: ${respText.slice(0, 800)}`);
    }
    let clientSecret = "";
    try {
      clientSecret = JSON.parse(respText).clientSecret || "";
    } catch {
      /* ignore */
    }
    if (!clientSecret) throw new Error("payments/intent OK but no clientSecret in response");
    await page.getByRole("button", { name: /^pay \$/i }).waitFor({ state: "visible", timeout: 60000 });
    errLine("  Embedded payment form visible (Stripe Payment Element).");

    errLine("\nOK — checkout shows in-page Stripe payment (customer can enter a test card and pay).");
    errLine("Use Stripe test cards in the Payment Element if keys are in test mode.\n");
  } finally {
    await ctx.close();
    await browser.close();
    if (process.env.E2E_KEEP_PRODUCT === "1") {
      errLine(`E2E_KEEP_PRODUCT=1 — leaving product ${productId} in catalog.`);
    } else {
      errLine(`Cleaning up: delete product ${productId}`);
      await deleteE2EProduct(adminToken, productId);
    }
  }
}

main().catch((e) => {
  errLine(String(e.message || e));
  process.exit(1);
});
