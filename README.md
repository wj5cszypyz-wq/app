# Larder

Wholesale ordering for food suppliers. Restaurants order from their phone; each order becomes a
QuickBooks Online invoice automatically, and the supplier sees it live with a printable invoice and
packing slip.

> "Larder" is a placeholder name. Change it in `lib/brand.ts`.

## What's built

**Supplier (wholesaler)**
- **Command**: live order board (updates every 5 s, new-order alert + optional sound), today's sales, open orders, QuickBooks issues
- **Orders**: full history, fulfillment pipeline (New → Packing → Ready → Delivered), cancel/reopen
- **Print**: invoice and packing slip (checkbox + "packed" column + signature line), Letter size
- **QuickBooks card** on every order: invoice number, open in QuickBooks, QuickBooks' own PDF, retry on failure
- **Catalog**: add products, edit prices inline, in-stock switch, remove
- **Customers**: add restaurants with a login, set custom prices per restaurant
- **QuickBooks settings**: connect / reconnect / disconnect, sync counts

**Restaurant (buyer)**
- Catalog with *their* prices, search (`/` to focus), aisles, "Your usuals" from past orders
- Cart that survives refresh, delivery date, note to supplier
- Order confirmation, history, one-tap reorder

**QuickBooks sync** (`lib/qbo.ts`, `lib/sync.ts`)
- OAuth 2.0 connect with CSRF state check; tokens encrypted at rest (AES-256-GCM); auto refresh
- Restaurant → QuickBooks **Customer** (matched by name or created)
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

3. Open http://localhost:3000 and click **Try as restaurant** or **Try as supplier**.
   Demo accounts have random passwords nobody knows; the demo buttons only work locally with `DEMO_MODE="true"` and are switched off in production builds.

## Security

- **Sessions:** random 256-bit token in an HttpOnly cookie (JavaScript can't read it; `__Host-` + Secure in production). The database stores only its SHA-256 hash. Signing out deletes the session server-side, so a copied cookie stops working.
- **Passwords:** bcrypt-hashed, never sent to the browser. Login is rate-limited (8 tries per email / 30 per IP per 15 min) and takes the same time whether or not the email exists.
- **CSRF:** every data-changing API call must come from this site's own pages (Origin check).
- **Headers:** strict Content-Security-Policy, no framing, nosniff, no-store caching for signed-in pages and API, HSTS in production.
- **QuickBooks tokens:** encrypted at rest with AES-256-GCM; never sent to the browser.
- **Browser storage:** only the cart (product IDs and quantities). Wiped on sign-out.
- **Access control:** every page and API call re-checks the session and role on the server; restaurants only see their own orders and prices.
- `npm audit`: 0 known vulnerabilities.

Run the tests:

```bash
npm test
```

## Connect QuickBooks (sandbox, free)

1. Sign in at https://developer.intuit.com → **My Apps** → **Create an app** → QuickBooks Online and Payments → scope **Accounting**.
2. **Development → Keys & credentials**: add Redirect URI `http://localhost:3000/api/qbo/callback`.
3. Copy **Client ID** and **Client Secret** into `.env` (`QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`). Leave `QBO_ENV="sandbox"`.
4. Restart `npm run dev`, sign in as the supplier, go to **QuickBooks → Connect QuickBooks**, pick your sandbox company.
5. Sign in as the restaurant, place an order, and watch the invoice appear in your sandbox QuickBooks.

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
  login/              sign-in (both roles)
  supplier/           command board, orders, catalog, customers, QuickBooks settings
  shop/               restaurant storefront, history, order confirmation
  print/[id]          invoice / packing slip
  api/                auth, orders, supplier CRUD, QuickBooks OAuth
lib/
  qbo.ts              QuickBooks API client (OAuth, customers, items, invoices, PDF)
  sync.ts             order → invoice orchestration
  orders.ts           order validation + pricing (unit tested)
  invoice.ts          QuickBooks invoice payload (unit tested)
prisma/               schema + demo seed
```
