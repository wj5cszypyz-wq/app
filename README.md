# OrderDock

Ordering stores for any seller (produce wholesalers, lamp makers, any niche). Each seller gets their own
separate store at `/s/<store-name>`; their customers order from their phone, each order becomes a
QuickBooks Online invoice automatically, and the seller sees it live with a printable invoice and
packing slip. Build plan: `docs/superpowers/plans/2026-11-07-roadmap.md`.

> The product name lives in `lib/brand.ts` (one place; every screen and email uses it).

## What's built

**Accounts**
- Sellers open a store at `/signup`; the store opens to customers once the owner confirms their email
- Customers and staff join by emailed invite; optional public "request an account" page at `/join/<store>`
- Forgot/reset password, change password, sign out other devices, optional two-step sign-in (`/account`)
- Platform admin at `/admin` (`npm run make-admin -- you@example.com`)
- Emails print in the dev terminal locally; production uses Resend (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`)

**Seller (store owner or staff)** at `/s/<store>/manage`
- **Command**: live order board (updates every 5 s, new-order alert + optional sound), today's sales, open orders, QuickBooks issues
- **Orders**: full history, fulfillment pipeline (New → Packing → Ready → Delivered), cancel/reopen
- **Print**: invoice and packing slip (checkbox + "packed" column + signature line), Letter size
- **QuickBooks card** on every order: invoice number, open in QuickBooks, QuickBooks' own PDF, retry on failure
- **Catalog**: add products, edit prices inline, in-stock switch, remove
- **Customers**: add customers with a login, set custom prices per customer
- **QuickBooks settings**: connect / reconnect / disconnect, sync counts

**Customer (buyer)** at `/s/<store>`
- Catalog with *their* prices, search (`/` to focus), aisles, "Your usuals" from past orders
- Cart that survives refresh, delivery date, note to the seller
- Order confirmation, history, one-tap reorder

**QuickBooks sync** (`lib/qbo.ts`, `lib/sync.ts`)
- OAuth 2.0 connect with CSRF state check; tokens encrypted at rest (AES-256-GCM); auto refresh
- Customer → QuickBooks **Customer** (matched by name or created)
- Product → QuickBooks **Item**, Non-inventory (matched by name or created)
- Order → **Invoice** numbered `ORD-####`, using `requestid` so a retry can never create a duplicate
- Failures never lose the order: it's flagged on the board with the exact QuickBooks error and a Retry button

## Run it on your Mac

1. Install **Node.js 22 LTS or newer** from https://nodejs.org (the macOS installer).
2. In this folder:

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run dev
```

3. Open http://localhost:3000 and click one of the demo buttons: two separate demo stores (Harbor Fresh, a produce wholesaler, and Brightline Lamps), each with **Try as customer** and **Try as seller**.
   Demo accounts have random passwords nobody knows; the demo buttons only work locally with `DEMO_MODE="true"` and are switched off in production builds.

## Security

- **Sessions:** random 256-bit token in an HttpOnly cookie (JavaScript can't read it; `__Host-` + Secure in production). The database stores only its SHA-256 hash. Signing out deletes the session server-side, so a copied cookie stops working.
- **Passwords:** bcrypt-hashed, never sent to the browser. Login is rate-limited (8 tries per email / 30 per IP per 15 min) and takes the same time whether or not the email exists.
- **CSRF:** every data-changing API call must come from this site's own pages (Origin check).
- **Headers:** strict Content-Security-Policy, no framing, nosniff, no-store caching for signed-in pages and API, HSTS in production.
- **QuickBooks tokens:** encrypted at rest with AES-256-GCM; never sent to the browser.
- **Browser storage:** only the cart (product IDs and quantities). Wiped on sign-out.
- **Store isolation:** every page and API call checks, on the server, that the signed-in person belongs to the store in the address (`lib/scope.ts`); anything else is "not found". All store data goes through `lib/data/*`, which always filters by that store (and by customer, for buyers). Tests try every action as every kind of outsider (`tests/integration/routes.test.ts`), and a guard test fails if a new page or action skips the check.
- **Customers only see their own orders and prices.**
- `npm audit`: 0 known vulnerabilities.

Run the tests (unit + integration; uses its own throwaway database, `prisma/test.db`):

```bash
npm test
```

Real-browser check (store isolation, every page loads, nothing wider than the screen), with `npm run dev` running:

```bash
node tests/e2e/isolation.e2e.mjs
```

## Connect QuickBooks (sandbox, free)

1. Sign in at https://developer.intuit.com → **My Apps** → **Create an app** → QuickBooks Online and Payments → scope **Accounting**.
2. **Development → Keys & credentials**: add Redirect URI `http://localhost:3000/api/qbo/callback`.
3. Copy **Client ID** and **Client Secret** into `.env` (`QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`). Leave `QBO_ENV="sandbox"`.
4. Restart `npm run dev`, sign in as a seller (store owner), go to **QuickBooks → Connect QuickBooks**, pick your sandbox company.
5. Sign in as that store's customer, place an order, and watch the invoice appear in your sandbox QuickBooks.

## Going live (checklist)

- [ ] Postgres database (Neon, Supabase, or Railway): set `DATABASE_URL`, change `provider` to `"postgresql"` in `prisma/schema.prisma`
- [ ] Host the app (Vercel or Railway) on your own domain with HTTPS
- [ ] New `SESSION_SECRET` (`openssl rand -base64 48`), `DEMO_MODE="false"`
- [ ] Privacy Policy + Terms of Use pages (Intuit requires both)
- [ ] Intuit production questionnaire → production keys → `QBO_ENV="production"`, production redirect URI
- [ ] Add password reset by email and "change password" before onboarding real customers
- [ ] If you run more than one server, move the login rate limiter to Redis
- [ ] Sales tax: decide per supplier (many food sales to restaurants are tax-exempt; QuickBooks automated sales tax can apply it)

## Not built yet (next up)

Online payments (Stripe Connect), standing orders, order cutoff times, email/SMS order notifications,
supplier staff invites, CSV catalog import, QuickBooks Desktop (Web Connector), native App Store apps.

## Layout

```
app/
  login/              sign-in
  stores/             "choose a store" for people with access to more than one
  s/[slug]/manage/    seller: today board, orders, products, customers, QuickBooks settings
  s/[slug]/(shop)/    customer: storefront, history, order confirmation
  s/[slug]/print/[id] invoice / packing slip
  api/s/[slug]/       every store action (checked by lib/scope.ts)
  api/qbo/callback    QuickBooks sign-in return address (fixed, as Intuit requires)
lib/
  scope.ts            who may use which store (membership check on every request)
  data/               all store data reads/writes, always filtered by store
  qbo.ts              QuickBooks API client (OAuth, customers, items, invoices, PDF)
  sync.ts             order → invoice orchestration
  orders.ts           order validation + pricing (unit tested)
  invoice.ts          QuickBooks invoice payload (unit tested)
prisma/               schema + demo seed
```
