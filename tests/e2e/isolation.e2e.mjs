// Real-browser check against a running dev server with demo data (npm run setup && npm run dev).
// Signs in as each demo account, makes sure the other store is invisible, every page renders
// without errors, and nothing is wider than the screen on phone or desktop.
// Run: node tests/e2e/isolation.e2e.mjs [baseUrl]
import { createRequire } from "node:module";

// Playwright is pre-installed globally in some environments; require() finds it there too.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://localhost:3000";
let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
};

const ACCOUNTS = [
  {
    key: "harbor-fresh:owner",
    own: ["/s/harbor-fresh/manage", "/s/harbor-fresh/manage/orders", "/s/harbor-fresh/manage/catalog", "/s/harbor-fresh/manage/customers", "/s/harbor-fresh/manage/settings", "/s/harbor-fresh/manage/setup", "/s/harbor-fresh/manage/team"],
    foreign: ["/s/brightline/manage", "/s/brightline", "/s/brightline/manage/catalog"],
    foreignApi: ["/api/s/brightline/manage/orders?filter=all"],
  },
  {
    key: "brightline:owner",
    own: ["/s/brightline/manage", "/s/brightline/manage/catalog", "/s/brightline/manage/customers", "/s/brightline/manage/setup", "/s/brightline/manage/team", "/s/brightline/manage/history"],
    foreign: ["/s/harbor-fresh/manage", "/s/harbor-fresh"],
    foreignApi: ["/api/s/harbor-fresh/manage/orders?filter=all"],
  },
  {
    key: "brightline:buyer",
    own: ["/s/brightline", "/s/brightline/orders"],
    mustSee: { "/s/brightline": ["Globe Pendant, Opal Glass", "Linen Drum Shade", "Floor lamps", "Hand-Blown Glass Globe Pendant", "$1,249.00"] },
    foreign: ["/s/harbor-fresh", "/s/harbor-fresh/orders", "/s/brightline/manage"],
    foreignApi: ["/api/s/harbor-fresh/manage/orders?filter=all", "/api/s/brightline/manage/orders?filter=all"],
  },
  {
    key: "harbor-fresh:buyer",
    own: ["/s/harbor-fresh", "/s/harbor-fresh/orders"],
    foreign: ["/s/brightline", "/s/harbor-fresh/manage"],
    foreignApi: ["/api/s/brightline/manage/orders?filter=all"],
  },
];

const browser = await chromium.launch();
for (const acct of ACCOUNTS) {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 860 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !/404 \(Not Found\)/.test(m.text()) && errors.push(m.text()));

    const login = await page.request.post(`${BASE}/api/auth/demo`, {
      data: { key: acct.key },
      headers: { origin: BASE },
    });
    ok(login.ok(), `${acct.key} @${width}: demo sign-in`);

    for (const path of acct.own) {
      const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
      ok(res?.status() === 200, `${acct.key} @${width}: ${path} loads`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(overflow <= 0, `${acct.key} @${width}: ${path} fits the screen (overflow ${overflow}px)`);
      for (const text of acct.mustSee?.[path] ?? []) {
        ok((await page.getByText(text, { exact: false }).count()) > 0, `${acct.key} @${width}: ${path} shows "${text}"`);
      }
    }
    for (const path of acct.foreign) {
      const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
      ok(res?.status() === 404, `${acct.key} @${width}: ${path} is not found (${res?.status()})`);
    }
    for (const path of acct.foreignApi) {
      const res = await page.request.get(BASE + path);
      ok(res.status() === 404, `${acct.key} @${width}: API ${path} is not found (${res.status()})`);
    }
    ok(errors.length === 0, `${acct.key} @${width}: no browser errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ""}`);
    await context.close();
  }
}

// Signed out: store pages bounce to sign-in, APIs say 401.
const anon = await browser.newContext();
const p = await anon.newPage();
await p.goto(`${BASE}/s/brightline/manage`, { waitUntil: "networkidle" });
ok(new URL(p.url()).pathname === "/login", "signed out: store page redirects to sign-in");
const api = await p.request.get(`${BASE}/api/s/brightline/manage/orders`);
ok(api.status() === 401, `signed out: API says 401 (${api.status()})`);
// Public account pages render, fit a phone screen, and reveal nothing they shouldn't.
for (const width of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: 860 } });
  const pg = await ctx.newPage();
  for (const [path, status] of [["/login", 200], ["/signup", 200], ["/forgot", 200], ["/reset?token=nope", 200], ["/invite?token=nope", 200], ["/join/brightline", 404], ["/join/no-such-store", 404]]) {
    const res = await pg.goto(BASE + path, { waitUntil: "networkidle" });
    ok(res?.status() === status, `public @${width}: ${path} → ${status} (${res?.status()})`);
    const overflow = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(overflow <= 0, `public @${width}: ${path} fits the screen (overflow ${overflow}px)`);
  }
  await ctx.close();
}

// Sign up a brand-new seller: lands in their own store with the "confirm your email" notice,
// and can't see the demo stores.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 } });
  const pg = await ctx.newPage();
  const slug = `e2e-${Date.now().toString(36)}`;
  await pg.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await pg.fill("#f-name", "Test Seller");
  await pg.fill("#f-email", `${slug}@example.test`);
  await pg.fill("#f-password", "a-long-test-password");
  await pg.fill("#f-storeName", "E2E Candles");
  await pg.fill("#f-slug", slug);
  await pg.click("button[type=submit], form button.btn-primary");
  await pg.getByText("Check your email").waitFor({ timeout: 15000 }).catch(() => {});
  ok((await pg.getByText("Check your email").count()) > 0, "sign-up asks to check email (no automatic sign-in)");
  ok(!(await ctx.cookies()).some((c) => c.name.includes("larder_sid")), "sign-up alone doesn't sign anyone in");
  // The new owner can sign in with their password and set up while the store is unconfirmed.
  await pg.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await pg.fill("#email", `${slug}@example.test`);
  await pg.fill("#password", "a-long-test-password");
  await pg.click("form button.btn-primary");
  await pg.waitForURL(`**/s/${slug}/manage`, { timeout: 15000 }).catch(() => {});
  ok(new URL(pg.url()).pathname === `/s/${slug}/manage`, `new owner signs in to their store (${pg.url()})`);
  ok((await pg.getByText("isn't open to customers yet").count()) > 0, "sign-up: confirm-email notice shows");
  const overflow = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, `sign-up: new store fits the phone screen (overflow ${overflow}px)`);
  const other = await pg.goto(`${BASE}/s/brightline/manage`, { waitUntil: "networkidle" });
  ok(other?.status() === 404, "new seller can't open another store");
  const admin = await pg.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  ok(admin?.status() === 404, "non-admin gets 404 on /admin");
  const acct = await pg.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  ok(acct?.status() === 200, "account page loads");
  await ctx.close();
}

await browser.close();

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
