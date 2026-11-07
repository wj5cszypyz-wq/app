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
    own: ["/s/harbor-fresh/manage", "/s/harbor-fresh/manage/orders", "/s/harbor-fresh/manage/catalog", "/s/harbor-fresh/manage/customers", "/s/harbor-fresh/manage/settings"],
    foreign: ["/s/brightline/manage", "/s/brightline", "/s/brightline/manage/catalog"],
    foreignApi: ["/api/s/brightline/manage/orders?filter=all"],
  },
  {
    key: "brightline:owner",
    own: ["/s/brightline/manage", "/s/brightline/manage/catalog", "/s/brightline/manage/customers"],
    foreign: ["/s/harbor-fresh/manage", "/s/harbor-fresh"],
    foreignApi: ["/api/s/harbor-fresh/manage/orders?filter=all"],
  },
  {
    key: "brightline:buyer",
    own: ["/s/brightline", "/s/brightline/orders"],
    mustSee: { "/s/brightline": ["Globe Pendant, Opal Glass", "Linen Drum Shade", "Floor lamps"] },
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
await browser.close();

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
