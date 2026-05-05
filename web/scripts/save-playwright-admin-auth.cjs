/**
 * Open a real browser, sign in to the storefront, then save Playwright storage state (cookies + localStorage).
 * The auth token lives in localStorage under `hb_token` (see src/lib/authToken.ts).
 *
 * Usage (from web/):
 *   BASE_URL=https://your-store.vercel.app npm run save:playwright-auth
 *
 * Optional: AUTH_STATE_PATH=/abs/path/auth.json  PLAYWRIGHT_CHANNEL=chrome
 *
 * Do not commit the output file — it contains your session token.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

function ensurePlaywrightBrowsersPath() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return;
  const sibling = path.join(__dirname, "..", "..", "..", "playwright-browsers");
  if (fs.existsSync(sibling)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = sibling;
  }
}

const BASE = (process.env.BASE_URL || "https://heavens-boutique-web-steel.vercel.app").replace(/\/+$/, "");
const OUT = path.resolve(
  process.env.AUTH_STATE_PATH || path.join(__dirname, "..", "playwright-admin-auth.json"),
);

function question(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

async function launchHeaded() {
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
  process.stderr.write(`BASE_URL=${BASE}\n`);
  process.stderr.write(`Saving storage state to: ${OUT}\n\n`);

  const browser = await launchHeaded();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginUrl = `${BASE}/login?next=${encodeURIComponent("/admin")}`;
    await page.goto(loginUrl, { waitUntil: "load", timeout: 120000 });

    process.stderr.write(
      "A browser window should show the sign-in page. Log in with an admin or staff account.\n",
    );
    process.stderr.write("When the admin dashboard has loaded (you are no longer on /login), ");
    await question("press Enter here to save the session → ");

    await context.storageState({ path: OUT });
    process.stderr.write(`\nWrote ${OUT}\n`);
    process.stderr.write("Run: npm run check:console\n");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
