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

## Direction change (2026-11-07): store builder for any seller
- The owner wants Larder to become a store template **any seller** can fill in (produce, lamps, any niche),
  each with **its own separate store**, with QuickBooks invoicing as the main selling point.
- Approved design: `docs/superpowers/specs/2026-11-07-multi-niche-stores-design.md`.
- Build roadmap (7 phases, each ends tested and pushed): `docs/superpowers/plans/2026-11-07-roadmap.md`.
- Work happens on branch `claude/loving-fermi-42tguu`; `main` still has the original single-supplier app.

### Phase 1 (multi-store foundation): done
- `Store` / `Membership` / `Customer` models; stores at `/s/<slug>` (customers) and `/s/<slug>/manage` (sellers).
- `lib/scope.ts` checks membership on every request; `lib/data/*` is the only place store data is read/written.
- Tests: 120 unit/integration tests incl. a break-in matrix over every store action, guard tests that fail if a
  page or action skips the check, and a real-browser script (`tests/e2e/isolation.e2e.mjs`, 96+ checks).
- Two demo stores: Harbor Fresh (produce) and Brightline Lamps. Demo buttons on the sign-in page.
- Known gaps handled in later phases: categories/units are still the food list when **adding** products
  (phase 3), customers get temporary passwords instead of email invites (phase 2), no sign-up yet (phase 2).

### Phase 2 (accounts): done
- Sign-up at `/signup` (store starts "unverified": sellers can set up, customers can't order until the owner
  clicks the emailed confirmation link). Forgot/reset password, change password, sign out other devices (`/account`).
- Customers and staff get **emailed invites** (no more temporary passwords). Team page; owner can remove staff.
- Optional public "request an account" page `/join/<store>` (off by default; owner switch on the Customers page).
- Optional two-step sign-in (authenticator app + 10 one-time recovery codes).
- Platform admin page `/admin` (suspend/reopen stores; no access to their orders/customers). Make yourself admin
  with `npm run make-admin -- you@example.com` after signing up.
- Email: printed in the `npm run dev` terminal locally (click the links there). Production needs a Resend
  account: set `RESEND_API_KEY`, `EMAIL_FROM` and `APP_URL` in `.env`.

### Phase 3 (setup, looks, photos, units): done
- "Store setup" page (sign-up lands there): what you sell, contact, delivery/pickup, look (Fresh market, Clean,
  Warm craft, Classic), button color (auto-darkened if hard to read), logo, banner, which kinds of items you sell.
- Products: any kind of item with the right units (weight, liquid, paper, length, single items, packed goods),
  pack contents ("case of 24 × 12 fl oz"), "billed by actual weight", description, up to 4 photos, per-store
  categories with an emoji. Customers see "$42.00 per case of 24 × 12 fl oz".
- Photos are checked by their real content, re-encoded to WebP (hidden data stripped), stored in `uploads/`
  (never committed, never public) and only shown to members of that store.
- Fixed: signed-in pages at the new `/s/...` addresses are now marked "never cache".

### Phase 4 (QuickBooks): done, tested against a fake QuickBooks (not yet against Intuit)
- "Bring in from QuickBooks" on the QuickBooks page: items, customers, and (optional) past invoices since a date.
  Preview first, tick what to bring in, undo any run. Re-running updates instead of duplicating; same SKU or
  same customer name links instead of creating a copy.
- Invoices: never duplicated (one send per order at a time + QuickBooks request ids); token refresh can't race;
  inactive QuickBooks items/customers and vendor/employee name clashes give a clear message instead of a copy.
- Unit conversion per product ("1 case = 40 lb" in QuickBooks); falls back to the sold unit if the money
  wouldn't add up to the cent.
- Cancelling an invoiced order voids the invoice in QuickBooks; reopening makes a fresh one (`ORD-1004-2`).
- All of this runs against `tests/helpers/fake-qbo.ts`. The owner's sandbox test is still the real proof.

## Next steps (in order)
1. Phase 5 of the roadmap (smart product entry).
2. QuickBooks sandbox test (needs the owner's Intuit developer keys): connect, bring in items/customers,
   place an order, cancel it (void), reopen it.
3. Before real customers: Postgres, hosting with HTTPS, Privacy Policy +
   Terms (Intuit requires them), Intuit production approval, `DEMO_MODE="false"`.
4. Then: Stripe Connect payments, standing orders, order cutoff times, email/SMS order alerts.
