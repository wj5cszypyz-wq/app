# ReorderPal: project hand-off

The full picture for anyone (or any new session) picking this up. Last updated 2026-11-07.
Short rules are in `CLAUDE.md`; this file has the details.

## 1. The business
- **What:** a store builder for any seller. Each seller (produce wholesaler, lamp maker, paper supplier,
  anything) gets **their own separate store**. Their business customers order from their phone whenever
  they want instead of calling. **Every order becomes a QuickBooks Online invoice automatically**; the seller
  sees it live and prints the invoice and packing slip.
- **Who pays:** sellers (monthly subscription, not built yet). Their customers use it free.
- **Started as** a local competitor to BlueCart and Choco for food suppliers; widened on 2026-11-07 to any
  niche. Edge over BlueCart (from their public reviews): simple public pricing, invoices that print right,
  clear QuickBooks status with Retry, in-person local setup, a written promise never to market to a seller's
  customers, QuickBooks Desktop later.
- **How it reaches sellers:** the owner visits suppliers in person; sellers sign up and fill in their own store.
- **Later revenue ideas:** card/ACH fee via Stripe Connect, a buyer "Pro" plan (invoices into the buyer's own
  QuickBooks as Bills, price tracking), marketplace, rush-order fees. No per-order fees for buyers.

## 2. Name and domain
- **ReorderPal**, domain **reorderpal.com** (owner bought it 2026-11-07; registrar not recorded here).
- Name history: "Larder" (placeholder) → "OrderDock" (dropped: orderdock.com taken since 2004 and an
  "OrderDock" restaurant-ordering app already exists) → **ReorderPal** (.com was free, no same-name app found).
- Set in `lib/brand.ts`; internal names match (`reorderpal_sid` cookie, `reorderpal_*` browser keys).
- Owner should still do a quick check at tmsearch.uspto.gov (a web search isn't a legal trademark check).

## 3. How the owner works
See `CLAUDE.md`. In short: plain words, step by step, no made-up facts, finish the job, show it running,
light simple design, security first, ask before spending money.

## 4. What's built (branch `claude/loving-fermi-42tguu`; `main` still has the old single-supplier app)
Next.js 15 (App Router) + TypeScript + Prisma (SQLite locally; Postgres planned for production).

- **Separate stores:** customers at `/s/<store>`, sellers at `/s/<store>/manage`. `lib/scope.ts` checks the
  signed-in person's membership on every request; anything else is "not found". All store data goes through
  `lib/data/*`, always filtered by store (and by customer for buyers).
- **Accounts:** seller sign-up `/signup` (store opens to customers once the owner confirms their email;
  the emailed link signs them in), password reset, change password, sign out other devices, optional
  two-step sign-in with recovery codes (`/account`). Customers and staff join by **emailed invite**.
  Optional public "request an account" page `/join/<store>` (off by default). Team page (owner adds/removes
  staff). Platform admin `/admin` (suspend/reopen stores; can't see their orders or customers):
  `npm run make-admin -- you@example.com`.
- **Store setup** page (sign-up lands there; doubles as settings): what you sell, contact, delivery/pickup,
  4 looks (Fresh market, Clean, Warm craft, Classic), button color (auto-darkened if unreadable), logo,
  banner, which kinds of items you sell.
- **Products for any niche:** unit kinds (weight, liquid, paper, length, single items, packed goods) with
  matching units, pack contents ("$42.00 per case of 24 × 12 fl oz"), billed-by-weight, description, up to
  4 photos, each store's own categories with an emoji. Photos are checked by content, re-encoded to WebP,
  stored in `uploads/` (never public, never committed) and shown only to that store's members.
- **Smart product entry** (`lib/suggest.ts`): typing a new product's name fills in category, unit and pack
  size. Off until `ANTHROPIC_API_KEY` is set. Uses Claude Opus 5.5 at low effort; cost not measured yet
  (estimated under 1 cent per product); Claude Haiku 5.5 would be ~1/40 the cost, owner's call.
- **Ordering:** storefront with the customer's own prices, search, "Order again", cart, delivery/pickup date,
  note, confirmation, history, one-tap reorder. Seller: live Today board, all orders, New → Packing →
  Ready → Delivered, cancel/reopen, printable invoice + packing slip.
- **QuickBooks** (`lib/qbo.ts`, `lib/sync.ts`, `lib/data/qbo-import.ts`): connect per store; every order →
  invoice; never duplicates (one send at a time + request ids); token refresh can't race; links existing
  QuickBooks items/customers instead of copying; clear messages for inactive items and name clashes; unit
  conversion ("1 case = 40 lb"); cancelling voids the invoice, reopening makes a fresh one; orders remember
  which QuickBooks company they belong to. "Bring in from QuickBooks": items, customers, optional past
  invoices, with preview and undo. **Tested only against `tests/helpers/fake-qbo.ts`, not real Intuit yet.**
- **Undo/redo + History** for product, special-price and store-settings changes; removed products can be
  restored.
- **Security review:** an independent reviewer checked the whole branch; 11 findings (1 critical) all fixed
  with tests (`tests/integration/review-fixes.test.ts`). No cross-store access found.
- **Verified** (fresh clone): 309 tests, type check, production build, `npm audit` = 0, 162 real-browser checks.

## 5. Run it
```
cp .env.example .env            # then put a long random value in SESSION_SECRET (openssl rand -base64 48)
npm install
npm run setup                   # creates the local database with two demo stores
npm run dev                     # http://localhost:3000
```
Demo buttons on the sign-in page: Harbor Fresh (produce) and Brightline Lamps, as seller or customer.
Emails print in the `npm run dev` terminal locally (click the links there).

**Owner's Mac:** no Xcode Command Line Tools at last check (no git/python3) → `xcode-select --install`.
Node 22 is in `~/.local/node`: `export PATH="$HOME/.local/node/bin:$PATH"`.

**Cloud sessions:** the preview runs on port 3000 for at most 2 hours per start; the owner sees it through the
Claude app's preview pane or screenshots, not by typing localhost. `rdap.verisign.com` is allowed in this
environment for .com availability checks.

## 6. Getting into QuickBooks (the plan the owner agreed to)
A. **Sandbox test on the owner's Mac** (needs their Intuit developer account): create an app at
   developer.intuit.com (QuickBooks Online, Accounting scope) → redirect URI
   `http://localhost:3000/api/qbo/callback` → dev keys into `.env` → connect the sandbox company → place an
   order → invoice appears → try Bring in from QuickBooks, cancel (void), reopen. Can't be done from a cloud
   session (Intuit redirects to the owner's own localhost).
B. **Put it online:** Vercel hosting + Postgres (e.g. Neon) + online photo storage + reorderpal.com pointed at
   it + Privacy Policy, Terms of Use (EULA) and a disconnect page.
C. **Production keys:** developer portal → Production Settings (app details + URLs on reorderpal.com) →
   App Assessment Questionnaire (required for every app using real data) → approval → production keys →
   `QBO_ENV="production"`.
D. **QuickBooks App Store listing:** three-part review (technical, security, marketing), listing page (name,
   icon, screenshots, description, pricing), annual re-review. Third parties report 6 weeks to several months.
   Intuit App Partner Program: free Builder tier; Core API calls free; "CorePlus" calls capped on Builder,
   billed on paid tiers (check which of our calls are CorePlus before launch).

## 7. Next steps (in order)
1. **Put the app online on reorderpal.com** (step B): switch to Postgres, online photo storage, Vercel
   deploy, connect the domain, add Privacy Policy / Terms / disconnect pages. Owner signs up for Vercel and
   Neon (free tiers); the assistant does the code.
2. **QuickBooks sandbox test** (step A) with the owner, click by click.
3. **Real email** (Resend; send from orders@reorderpal.com) and optional `ANTHROPIC_API_KEY`.
4. **Before real sellers:** Intuit production keys (step C), `DEMO_MODE="false"`, new `SESSION_SECRET`,
   seller billing (monthly subscription, e.g. Stripe), merge the branch into `main`.
5. **Then:** QuickBooks App Store listing (step D), card/ACH payments, standing orders, order cutoff times,
   email/SMS order alerts, CSV product import, QuickBooks Desktop, phone app stores.

## 8. Known small gaps
- Pickup-only stores still show the status word "Delivered".
- Undo history doesn't cover customer details or account-request decisions (products, special prices and
  store settings are covered).
- Same-name customers in one store link to the same QuickBooks customer (by design, to avoid duplicates).
