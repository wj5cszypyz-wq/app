# Larder — project hand-off

Read this first in any new session. Last updated 2026-11-06.

## The business
- **Who:** the owner is building a local competitor to **BlueCart** (bluecart.com) and **Choco** (choco.com/us).
- **What:** wholesale ordering for food suppliers (produce, dairy, meat, bakery, dry goods, paper goods).
  Restaurants order in the app → order becomes a **QuickBooks Online invoice automatically** → the supplier
  sees it live and prints the invoice and packing slip.
- **Customers who pay:** suppliers (wholesalers). Restaurants use it free; they follow their supplier.
- **Edge vs. BlueCart** (from public reviews): public simple pricing, rock-solid invoice printing, clear
  QuickBooks sync status with retry, in-person local setup, a written promise to never market to a supplier's
  customers, QuickBooks Desktop support later.
- **Later revenue ideas:** card/ACH payment fee via Stripe Connect, restaurant "Pro" plan (invoices into the
  restaurant's own QuickBooks as Bills, price tracking), marketplace, rush-order fees. Avoid per-order fees.
- **"Larder" is a placeholder name.** Change it in `lib/brand.ts`.

## How the owner wants to work
- No fluff, no made-up facts. Plain language, step by step.
- **Design must be simple, light and "fresh market":** warm off-white, white cards, leaf green (#2e7d4a),
  category emojis, plain words. **Not futuristic/dark.** It was redesigned once for this reason.
- Security matters a lot: no secrets in the browser, server-side sessions, nothing sensitive in localStorage.

## Current state (done and verified)
- Next.js 15 + TypeScript + Prisma (SQLite locally; Postgres for production). Code is at the repo root.
- Supplier: Today board (live every 5 s), All orders, order detail with New→Packing→Ready→Delivered,
  printable invoice + packing slip, Products (inline price, stock switch), Customers (logins, per-customer
  prices), QuickBooks settings.
- Restaurant: storefront with their prices, categories, search, cart, delivery date, note, history, reorder.
- QuickBooks code: OAuth connect, Customer/Item/Invoice creation, `requestid` so retries never duplicate,
  PDF download, encrypted tokens. **Not yet tested against Intuit** — needs the owner's developer keys.
- Security (tested live): HttpOnly random session token, only its SHA-256 stored, server-side logout,
  login rate limit, CSRF Origin check, CSP + security headers, no secrets in browser build, `npm audit` = 0.
- Checks: 25 unit tests pass, `tsc` clean, `next build` passes.

## This Mac
- No Xcode Command Line Tools → **no git, no python3**. Apple's install pop-up has appeared; the owner can
  click Install or run `xcode-select --install`.
- Node 22 was installed to `~/.local/node` (official, checksum verified). Use:
  `export PATH="$HOME/.local/node/bin:$PATH"`
- Run: `npm run dev` → http://localhost:3000 (one-click demo buttons; `DEMO_MODE="true"` in `.env`).
- `.env` holds a generated `SESSION_SECRET`. **Never upload `.env` or `dev.db`.**

## GitHub
- Repo: https://github.com/wj5cszypyz-wq/app. Code is on `main`, at the repo root (done 2026-11-06).
- `.gitignore` keeps out `node_modules`, `.next`, `.env`, `.env.local`, `*.db` and build files.
- `.env.example` lists every setting. To start fresh: `cp .env.example .env`, put a long random value in
  `SESSION_SECRET` (`openssl rand -base64 48`), then `npm install` and `npm run setup`.
- Verified on 2026-11-06 in a fresh clone: `npm install` (0 vulnerabilities), 25/25 tests, `tsc` clean,
  `next build` passes, and every supplier and restaurant page loads with no errors.
- Demo buttons only appear with `npm run dev`. `npm start` (production) hides them on purpose.

## Next steps (in order)
1. ~~Push the code to GitHub~~ — done 2026-11-06.
2. Connect a free QuickBooks **sandbox** (developer.intuit.com → app → redirect URI
   `http://localhost:3000/api/qbo/callback` → keys into `.env`) and test a real invoice end-to-end.
3. Before real customers: password reset + change password, Postgres, hosting with HTTPS, Privacy Policy +
   Terms (Intuit requires them), Intuit production approval, `DEMO_MODE="false"`.
4. Then: Stripe Connect payments, standing orders, order cutoff times, email/SMS order alerts.
