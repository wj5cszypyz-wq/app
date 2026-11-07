# Phase 1: Multi-store foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-supplier Larder app into one app hosting many separate stores, where no user can read or change a store they don't belong to.

**Architecture:** `Supplier` becomes `Store` (with a unique `slug`), `Restaurant` becomes `Customer`, and a `Membership` table says which user has which role in which store. Every page and API route lives under `/s/[slug]/…` or `/api/s/[slug]/…` and gets its store only from `lib/scope.ts`, which checks the signed-in user's membership for that slug on every request. All database reads/writes for store data go through `lib/data/*`, whose functions take that verified context as their first argument.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 6 (SQLite dev), Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-07-multi-niche-stores-design.md` (§6.1, §6.2, §8 phase 1)

## Global Constraints

- No secrets in browser code; nothing sensitive in browser storage; never commit `.env` or `*.db`.
- Store ID comes **only** from the session's membership, never from a URL, form field or body (spec §6.2).
- Failed membership for a slug → **404**, not 403 (store existence isn't confirmed).
- Every lookup by ID includes `storeId` (and `customerId` for buyers).
- No SQLite-only features (must run on Postgres later).
- Keep existing security: hashed session tokens, CSRF Origin check, CSP, rate limits, demo only when `DEMO_MODE="true"` and not production.
- Design unchanged in this phase except wording "restaurant" → "customer" in shared UI; full niche-neutral wording is phase 3.
- Before each commit: `npm test`, `npx tsc --noEmit` pass. Before push at the end: also `npx next build`, `npm audit` = 0.
- No production data exists yet: schema change uses `prisma db push --force-reset` + reseed; no data migration.

## Review Focus

- A user who is owner of store A and buyer at store B acts on `/api/s/a/...` → uses A's owner context; on `/api/s/b/...` → buyer context only (Task 3 test `multi-membership`).
- A buyer guesses another customer's order ID **in the same store** → 404 (Task 4 test `buyer cannot read other customer's order`).
- Store suspended while users are signed in → every page/API for it returns 404 on the next request (Task 3 test `suspended store`).
- Slug in a different case (`/s/Harbor-Fresh`) → treated as `harbor-fresh`; unknown or malformed slug → 404 (Task 3 test `slug normalization`).
- Membership removed while signed in → the next request is denied, nothing cached across requests (Task 3 test `removed membership`).

---

## File structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `Store`, `Membership`, `Customer` models; `storeId` everywhere |
| `prisma/seed.ts` | Two demo stores: Harbor Fresh (produce) and Brightline Lamps (lamps), each with owner, staff, 2 customers with buyers, products, orders |
| `lib/session.ts` | Session now carries only `userId`, `name`, `isPlatformAdmin` |
| `lib/scope.ts` | `StoreCtx`, `normalizeSlug`, `resolveMembership`, `requireStorePage`, `storeApi` |
| `lib/data/orders.ts`, `lib/data/products.ts`, `lib/data/customers.ts`, `lib/data/storefront.ts`, `lib/data/stores.ts` | All store-data queries, each taking `ctx: StoreCtx` first |
| `lib/sync.ts`, `lib/qbo.ts` | `Supplier`→`Store` rename only |
| `app/api/s/[slug]/…` | All store API routes (moved from `app/api/supplier`, `app/api/orders`, `app/api/qbo/{connect,disconnect}`) |
| `app/api/qbo/callback/route.ts` | Stays at fixed URL (Intuit needs an exact redirect); store comes from the state cookie, re-verified |
| `app/s/[slug]/…` | Storefront (buyer) at `/s/[slug]`, seller pages at `/s/[slug]/manage/…`, print at `/s/[slug]/manage/print/[id]` |
| `app/stores/page.tsx` | "Choose a store" list after sign-in when the user has more than one membership |
| `middleware.ts` | Matcher `/s/:path*`, `/stores`, `/api/:path*` |
| `tests/setup/db.ts`, `tests/helpers/fixtures.ts`, `tests/helpers/request.ts` | Integration test DB, two-store fixtures, cookie-mocked route calling |
| `tests/integration/*.test.ts` | Scope, data layer, route isolation matrix, static guards |
| `vitest.config.ts` | Unit + integration projects |

---

### Task 1: Integration test harness

**Files:**
- Create: `vitest.config.ts`, `tests/setup/db.ts`, `tests/helpers/request.ts`
- Modify: `package.json` (scripts), `.gitignore` (add `prisma/test.db*`; `*.db` already covers it — verify)

**Interfaces:**
- Produces: `npm test` runs `tests/**/*.test.ts`; integration tests get a fresh SQLite DB at `prisma/test.db` (env `DATABASE_URL="file:./test.db"`, `SESSION_SECRET` set to a 40-char test value, `DEMO_MODE` unset).
- Produces: `callRoute(handler, opts: { method: string; url: string; token?: string; body?: unknown; params?: Record<string,string>; origin?: string }): Promise<Response>` in `tests/helpers/request.ts`. It mocks `next/headers` `cookies()` so the session cookie is `token`, sets `Origin` to `http://localhost` unless overridden, and calls `handler(req, { params: Promise.resolve(params) })`.

- [ ] **Step 1:** `vitest.config.ts` with `test.globalSetup: "tests/setup/db.ts"`, `fileParallelism: false` (one shared SQLite file), `env` as above. `tests/setup/db.ts` runs `npx prisma db push --force-reset --skip-generate` against the test DB once.
- [ ] **Step 2:** Write `tests/integration/harness.test.ts`: `it("talks to the test database")` → `await db.store.count()` resolves to a number (will fail until Task 2 adds `Store`; for now assert `await db.$queryRaw\`SELECT 1\`` works).
- [ ] **Step 3:** Run `npm test`. Expected: existing 25 tests + harness test pass.
- [ ] **Step 4:** Commit `test: add integration test harness with isolated SQLite db`.

### Task 2: Schema — Store, Membership, Customer — and two-store seed

**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed.ts`, `lib/demo.ts`, `app/api/auth/demo/route.ts`, `app/login/login-form.tsx`
- Create: `tests/helpers/fixtures.ts`

**Interfaces:**
- Produces models:
  - `Store { id, slug @unique, name, niche String?, status String @default("active") /* "active"|"suspended" */, phone?, email?, address?, createdAt, qbo* fields unchanged, memberships, customers, products, orders }`
  - `Membership { id, userId, storeId, role String /* "owner"|"staff"|"buyer" */, customerId String?, createdAt; @@unique([userId, storeId]); @@index([storeId]) }` (onDelete Cascade from User and Store)
  - `Customer` = old `Restaurant` with `storeId` (fields unchanged incl. `qboCustomerId`), relations `memberships`, `orders`, `prices`
  - `User { id, email @unique, name, passwordHash, isPlatformAdmin Boolean @default(false), createdAt, sessions, memberships }` (no role/supplierId/restaurantId)
  - `Product`, `Order`: `supplierId`→`storeId`; `Order.restaurantId`→`customerId`; uniques become `@@unique([storeId, sku])`, `@@unique([storeId, number])`, `@@index([storeId, createdAt])`. `CustomerPrice.restaurantId`→`customerId`.
- Produces `makeStore(slug: string): Promise<{ store; owner; staff; buyerA; buyerB; customerA; customerB; product; orderA; orderB; tokens: { owner; staff; buyerA; buyerB } }>` in `tests/helpers/fixtures.ts` (tokens are real session tokens from `createSession`).
- Produces `DEMO_USERS` keyed `"harbor-fresh:owner" | "harbor-fresh:buyer" | "brightline:owner" | "brightline:buyer"`; demo route takes `{ key }`.

- [ ] **Step 1:** Update schema; run `npx prisma db push --force-reset && npx prisma generate`.
- [ ] **Step 2:** Rewrite seed: Harbor Fresh (slug `harbor-fresh`, niche "Produce and kitchen supplies", existing catalog/customers/orders) and Brightline Lamps (slug `brightline`, niche "Lamps and lampshades", categories Floor / Desk / Pendant / Shades, ~8 products sold "each", 2 customers, 2 orders). Same random-password rule.
- [ ] **Step 3:** Login page demo buttons: four buttons in two labelled groups (store name → "as seller" / "as customer"). Copy: "Harbor Fresh — try as seller", "— try as customer", same for Brightline.
- [ ] **Step 4:** Harness test now asserts `await makeStore("t1")` creates 1 store, 3 memberships with roles owner/staff/buyer×2.
- [ ] **Step 5:** `npm test` (unit tests that referenced old names updated), `npm run setup` succeeds. Commit `feat: multi-store schema and two-store demo seed`.

(Type errors in app code are expected after this task and fixed by Tasks 3–6; commit with `npx tsc` failing is allowed **only** for Tasks 2–5, and Task 6 must end clean. Keep these tasks on the branch without pushing until Task 6.)

### Task 3: Session and scope layer

**Files:**
- Modify: `lib/session.ts`, `lib/auth.ts`
- Create: `lib/scope.ts`, `tests/integration/scope.test.ts`

**Interfaces:**
- `Session = { sessionId: string; userId: string; name: string; isPlatformAdmin: boolean }`
- `type Role = "owner" | "staff" | "buyer"`; `const MANAGE: Role[] = ["owner", "staff"]`, `OWNER: Role[] = ["owner"]`, `BUY: Role[] = ["buyer"]`
- `type StoreCtx = { userId: string; storeId: string; slug: string; storeName: string; role: Role; customerId: string | null }`
- `normalizeSlug(raw: string): string | null` — lowercases; valid iff `/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/`; else null.
- `resolveMembership(userId: string, rawSlug: string): Promise<StoreCtx | null>` — null if slug invalid, store missing, store `status !== "active"`, no membership, or role `buyer` without `customerId`. One query, no caching beyond React `cache` per request.
- `requireStorePage(rawSlug: string, roles: Role[]): Promise<StoreCtx>` — no session → `redirect("/login?next=/s/<slug>")`; no membership or wrong role → `notFound()`. Exception: buyer hitting a manage page or staff hitting the storefront also gets `notFound()`.
- `storeApi(rawSlug: string, roles: Role[]): Promise<StoreCtx | Response>` — no session → 401 JSON `{ error: "Please sign in again." }`; otherwise any failure → 404 JSON `{ error: "Not found." }`.
- `homeFor(ctx: StoreCtx): string` → `/s/<slug>/manage` for owner/staff, `/s/<slug>` for buyer.

- [ ] **Step 1: Write failing tests** in `tests/integration/scope.test.ts` using two fixtures `a = makeStore("a")`, `b = makeStore("b")`:
  - `resolves owner of a` → `{ role: "owner", storeId: a.store.id }`
  - `owner of a gets null for b`
  - `multi-membership`: add membership (buyer at b, customer b.customerA) for `a.owner`; `resolveMembership(a.owner.id,"a").role === "owner"` and `("b").role === "buyer"` with `customerId === b.customerA.id`
  - `slug normalization`: `"A"` resolves; `"a/../b"`, `"-a"`, `""`, `"a".repeat(60)` → null
  - `suspended store`: set `a.store.status="suspended"` → null for every member; restore after
  - `removed membership`: delete staff membership → `resolveMembership(a.staff.id,"a")` null
  - `storeApi without session` → status 401; `storeApi("b", MANAGE)` as a's owner → 404
- [ ] **Step 2:** Run `npx vitest run tests/integration/scope.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `lib/scope.ts`; slim `lib/session.ts` `readSession` (reads `user.isPlatformAdmin`); remove `requireSupplier/requireBuyer/apiSession` from `lib/auth.ts` (keep `getSession`, `unauthorized`, `badRequest`).
- [ ] **Step 4:** Run → PASS. Commit `feat: store scope layer with membership checks`.

### Task 4: Data layer

**Files:**
- Create: `lib/data/stores.ts`, `lib/data/orders.ts`, `lib/data/products.ts`, `lib/data/customers.ts`, `lib/data/storefront.ts`, `tests/integration/data.test.ts`
- Delete: `lib/queries.ts` (contents move to `lib/data/orders.ts` / `storefront.ts`)

**Interfaces** (all first param `ctx: StoreCtx`; all `where` clauses include `storeId: ctx.storeId`; buyer-facing ones also `customerId: ctx.customerId`; "not found" returns `null`, never throws for a foreign ID):
- `orders.ts`: `loadBoard(ctx, filter: "open"|"all"|"done")`, `getOrderForStore(ctx, id)`, `getOrderForBuyer(ctx, id)`, `listBuyerOrders(ctx)`, `placeOrder(ctx, input: PlaceOrderInput)` (moved from `app/api/orders/route.ts`; validates every productId belongs to `ctx.storeId` and is active+in stock), `setOrderStatus(ctx, id, status)`.
- `products.ts`: `listProducts(ctx)`, `createProduct(ctx, input)`, `updateProduct(ctx, id, patch)` (returns null for foreign id).
- `customers.ts`: `listCustomers(ctx)`, `getCustomer(ctx, id)`, `createCustomerWithLogin(ctx, input)` (creates `Customer` + `User` (or reuses existing user by email) + buyer `Membership`; if that user already has a membership in this store → error "This email already has access to this store."), `setCustomerPrices(ctx, customerId, prices)` (rejects productIds not in store).
- `storefront.ts`: `loadStorefront(ctx)`, `orderAgainProductIds(ctx)`.
- `stores.ts`: `getStoreForCtx(ctx)` (full Store row incl. QuickBooks fields — server only), `listMembershipsForUser(userId)` → `{ slug, storeName, role }[]`.

- [ ] **Step 1: Write failing tests** `tests/integration/data.test.ts` (fixtures a, b):
  - `owner of a cannot read b's order` → `getOrderForStore(ctxA, b.orderA.id) === null`
  - `buyer cannot read other customer's order` → `getOrderForBuyer(ctxBuyerA_a, a.orderB.id) === null`
  - `updateProduct with b's product id` → null and b's product unchanged
  - `placeOrder with b's productId` → throws/returns error "unknown product", no order created in either store
  - `setCustomerPrices with b's productId` → rejected, no rows written
  - `createCustomerWithLogin` twice same email same store → second errors; same email in store b → succeeds (one User, two memberships)
  - `loadBoard(ctxA)` contains only a's orders
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: store-scoped data layer`.

### Task 5: API routes under `/api/s/[slug]` + isolation matrix

**Files:**
- Move/rewrite: `app/api/supplier/**` → `app/api/s/[slug]/manage/{orders,orders/[id],orders/[id]/sync,orders/[id]/invoice-pdf,products,products/[id],customers,customers/[id]/prices}/route.ts`; `app/api/orders/route.ts` → `app/api/s/[slug]/orders/route.ts`; `app/api/qbo/{connect,disconnect}` → `app/api/s/[slug]/manage/qbo/{connect,disconnect}/route.ts`
- Modify: `app/api/qbo/callback/route.ts`, `app/api/auth/login/route.ts` (response `redirect` = single membership's `homeFor`, else `/stores`), `app/api/auth/demo/route.ts`, `lib/sync.ts`, `lib/qbo.ts` (types `Supplier`→`Store`)
- Create: `tests/integration/routes.test.ts`, `tests/integration/static-guards.test.ts`

**Interfaces:**
- Every store route handler begins `const ctx = await storeApi((await params).slug, ROLES); if (ctx instanceof Response) return ctx;` and calls only `lib/data/*` / `lib/sync` / `lib/qbo` with `ctx`. Roles: manage routes `MANAGE`; `qbo/connect|disconnect` `OWNER`; `orders` (place) `BUY`.
- QBO connect: state cookie value `"<random>.<slug>"` (path `/api/qbo`, 10 min, HttpOnly, Lax). Callback: split, `resolveMembership(session.userId, slug)` must be `owner`, then compare random part with `timingSafeEqual`; on success redirect `/s/<slug>/manage/settings?qbo=connected`; any failure redirect to `/stores?qbo=invalid` (or settings of that slug if membership is valid).
- `ROUTES` manifest exported from `tests/integration/routes.test.ts`: `{ file: string; method: string; path: (slug, ids) => string; params: (slug, ids) => Record<string,string>; body?: unknown; roles: Role[] }[]` — one entry per route handler export.

- [ ] **Step 1: Write failing tests**
  - `routes.test.ts`: for every manifest entry, call as (signed out → 401), (store b owner, staff, buyerA → 404 using store a's slug and a's ids), (store a buyer on a manage route → 404), (allowed role of a → 2xx). For write routes, assert after each denied call that the target rows in a are unchanged (snapshot compare).
  - `static-guards.test.ts`:
    - `no file under app/ imports the database client` (grep `app/**/*.ts{,x}` for `@/lib/db` or `lib/db"` → none).
    - `every route under app/api/s is in the manifest` (glob `app/api/s/**/route.ts` × exported methods == manifest set).
    - `every route under app/api/s calls storeApi` (file text contains `storeApi(`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement routes. **Step 4:** Run → PASS. **Step 5:** Commit `feat: store-scoped API routes with isolation tests`.

### Task 6: Pages under `/s/[slug]` + store chooser

**Files:**
- Move: `app/supplier/**` → `app/s/[slug]/manage/**`; `app/shop/**` → `app/s/[slug]/(shop)/**` (storefront at `/s/[slug]`, orders at `/s/[slug]/orders`, `/s/[slug]/orders/[id]`); `app/print/[id]` → `app/s/[slug]/manage/print/[id]`
- Create: `app/stores/page.tsx`
- Modify: `middleware.ts` (matcher `["/s/:path*", "/stores", "/api/:path*"]`), `app/page.tsx` (signed in → single membership home or `/stores`; else `/login`), client components' `fetch` URLs (`/api/s/${slug}/...`) and links, `components/live-board.tsx` (slug prop), shared UI wording "Restaurant" → "Customer".
- Delete: old `app/supplier`, `app/shop`, `app/print`.

**Interfaces:**
- Each page/layout: `const ctx = await requireStorePage((await params).slug, MANAGE | BUY)`; data via `lib/data/*`.
- `/stores`: lists `listMembershipsForUser(session.userId)` as cards (store name, "Seller" / "Customer"), each linking to `homeFor`. Zero memberships → plain message "You don't have access to any store yet."

- [ ] **Step 1:** Move and rewire pages. **Step 2:** `npx tsc --noEmit` → clean; `npm test` → all pass.
- [ ] **Step 3:** Add to `static-guards.test.ts`: `every page under app/s calls requireStorePage` (each `page.tsx`/`layout.tsx` under `app/s/[slug]` contains `requireStorePage(`; layouts count for their children only if the page itself also calls it — require it in every `page.tsx`).
- [ ] **Step 4:** Commit `feat: store pages under /s/[slug] and store chooser`.

### Task 7: End-to-end check and handoff

**Files:**
- Create: `tests/e2e/isolation.e2e.mjs` (Playwright script, not part of `npm test`; run with `node`)
- Modify: `HANDOFF.md`, `README.md` (URLs, demo buttons), `docs/superpowers/plans/2026-11-07-roadmap.md` (phase 1 → done)

- [ ] **Step 1:** Script against `npm run dev` (port 3000, seeded DB): sign in as Harbor Fresh owner via demo → visit `/s/brightline/manage` and `/s/brightline` → both 404 page; `fetch('/api/s/brightline/manage/orders')` → 404; Harbor Fresh pages render with no console errors; repeat as Brightline customer for Harbor Fresh URLs. Also: at 390 px and 1280 px, `document.documentElement.scrollWidth <= innerWidth` on every page visited. Print `PASS`/`FAIL` lines; exit 1 on any FAIL.
- [ ] **Step 2:** Run: `npm test`, `npx tsc --noEmit`, `npx next build`, `npm audit` → 0 vulnerabilities, e2e script → all PASS.
- [ ] **Step 3:** Update HANDOFF/README/roadmap. Commit `docs: phase 1 handoff`; `git push -u origin claude/loving-fermi-42tguu`.
