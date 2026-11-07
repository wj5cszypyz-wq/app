# Phase 2: Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Sellers can sign up and open a store themselves; everyone gets email verification, password reset, change password, invites instead of temporary passwords, optional "request an account" for buyers, optional two-step sign-in, and the platform owner gets a page to suspend stores.

**Architecture:** One `AuthToken` table holds every emailed link (verify, reset, invite, two-step ticket), storing only a SHA-256 of the token, single-use, with an expiry. Email goes through `lib/email.ts` (Resend HTTP API in production; printed to the terminal and kept in an in-memory outbox in development/tests). Two-step codes are standard TOTP (RFC 6238) implemented with Node's `crypto`.

**Tech Stack:** as phase 1, plus `qrcode` (server-side SVG QR for authenticator setup).

**Spec:** `docs/superpowers/specs/2026-11-07-multi-niche-stores-design.md` (§6.1, §6.3, §10 Q2)

## Global Constraints

- Everything from phase 1's Global Constraints.
- Tokens: 256-bit random, only SHA-256 stored, single use, expiry: verify 24 h, reset 30 min, invite 7 days, two-step ticket 5 min.
- Passwords: 10–200 characters for new passwords (existing 8+ still sign in). bcrypt cost 10.
- "Forgot password" and "sign up with an email that exists" never reveal whether an email has an account.
- Changing or resetting a password signs out every other session; reset signs out all.
- New stores have status `"unverified"`: owner/staff can set up; buyers get 404 until the owner verifies their email (status → `"active"`). `"suspended"` blocks everyone.
- Rate limits (existing `lib/rate-limit.ts`): sign-up 5/IP/hour, forgot-password 5/email and 20/IP per hour, account requests 5/IP/hour, two-step 8 tries per ticket.
- No secrets (TOTP secrets, tokens) ever in browser code beyond the one-time setup screen; TOTP secret stored encrypted (`lib/crypto.ts`).
- Email links use `APP_URL` env (default `http://localhost:3000`); add to `.env.example`.

## Review Focus

- An invite opened while signed in as a *different* account → must not attach the store to the wrong person (Task 4 test `invite for another email while signed in`).
- Reset link used twice, or after a newer one was issued → second use fails (Task 3 test `reset token is single use`).
- Sign-up race: two sign-ups claim the same store address at once → one gets a clear "taken" message, no crash (Task 2 test `slug taken`).
- Account-request page for a store with requests off → 404, reveals nothing (Task 5 test `requests off → 404`).
- Two-step: the password-only step must not create a session (Task 6 test `password alone does not sign in when two-step is on`).

---

### Task 1: AuthToken model, token helpers, email outbox
- Create: `lib/tokens.ts`, `lib/email.ts`, `tests/integration/tokens.test.ts`; Modify: `prisma/schema.prisma`, `.env.example`
- Model `AuthToken { id String @id /* sha256 */, purpose String /* verify_email|reset_password|invite|two_step */, userId String?, email String?, storeId String?, customerId String?, role String?, expiresAt DateTime, usedAt DateTime?, createdAt DateTime @default(now()); @@index([userId, purpose]) }`; `User.emailVerifiedAt DateTime?`, `User.totpSecret String?`, `User.totpEnabledAt DateTime?`, `User.recoveryCodes String?` (JSON array of sha256 hashes).
- `issueToken(data: { purpose; userId?; email?; storeId?; customerId?; role?; ttlMs }): Promise<string>`; `consumeToken(raw: string, purpose): Promise<AuthToken | null>` — atomic `updateMany where usedAt null and expiresAt > now` → count 1 else null; `peekToken(raw, purpose)` (no consume, for showing invite details).
- `sendEmail({ to, subject, text }): Promise<void>`; `outbox` array exported for tests (dev/test only); `appUrl(path)`.
- Tests: token stored hashed; consume once → second null; expired → null; wrong purpose → null.

### Task 2: Seller sign-up and email verification
- Create: `app/signup/page.tsx` + form, `app/api/auth/signup/route.ts`, `app/verify/page.tsx` (consumes token server-side, shows result), `lib/data/signup.ts`, `tests/integration/signup.test.ts`
- Modify: `lib/scope.ts` (status `unverified`: allow owner/staff, not buyer), `lib/data/stores.ts` (`listMembershipsForUser` includes unverified for owner/staff), seller shell banner "Confirm your email to open your store to customers" with resend button (`app/api/auth/resend-verification/route.ts`), login page link "Open a store".
- `signUpSeller({ name, email, password, storeName, slug }): Promise<{ userId; slug } | { error }>` — validates (slug via `normalizeSlug`, reserved words `admin, api, login, signup, stores, verify, reset, invite, account, s`), creates user + store(`unverified`) + owner membership in one transaction; existing email → same success message to the browser but no account changes, and an email "someone tried to sign up with your address; sign in or reset your password" is sent instead.
- Tests: creates unverified store; verify link activates store and sets `emailVerifiedAt`; `slug taken` (P2002 → "That web address is taken."); existing email → no new user, generic response; buyer of unverified store → resolveMembership null.

### Task 3: Password reset, change password, sign out everywhere
- Create: `app/forgot/page.tsx`, `app/reset/page.tsx`, `app/account/page.tsx` (change password, two-step section placeholder, sign out everywhere), API routes `api/auth/forgot`, `api/auth/reset`, `api/account/password`, `api/account/sessions` (DELETE = sign out everywhere else)
- Tests: forgot for unknown email → same 200 message, no email; known → email with link; `reset token is single use`; newer reset invalidates older (issue deletes previous unused reset tokens); reset deletes all sessions; change password needs current password, keeps current session, deletes others.

### Task 4: Invites replace temporary passwords
- Create: `app/invite/page.tsx` (+ accept form), `api/invites/accept/route.ts`, `api/s/[slug]/manage/staff/route.ts` (OWNER: POST invite staff), `api/s/[slug]/manage/customers/[id]/invite/route.ts` (MANAGE: resend invite); Modify: customers POST → creates customer + invite (no password field), `lib/data/customers.ts`, add-customer form, route manifest.
- Accept rules: token must be unused/unexpired; if signed in and session email ≠ invite email → show "This invite is for x@…; sign out first" (no change); if a user with that email exists and is signed in → add membership; if exists but not signed in → ask to sign in, then accept; if no user → form (name, password) creates user with `emailVerifiedAt = now` + membership. Membership creation is idempotent (`@@unique([userId, storeId])`).
- Tests: `invite for another email while signed in`; accept creates user+membership once; reused token fails; staff invite only by owner (matrix).

### Task 5: Optional "request an account"
- Model: `Store.allowAccountRequests Boolean @default(false)`; `AccountRequest { id, storeId, businessName, contactName, email, phone?, message?, status "pending|approved|declined", createdAt }`.
- Create: `app/join/[slug]/page.tsx` (public; outside `/s/` so it isn't behind sign-in), `api/join/[slug]/route.ts` (public POST, rate-limited), seller UI on Customers page (pending list, Approve → customer + invite, Decline), settings toggle (`api/s/[slug]/manage/store/route.ts` PATCH `{ allowAccountRequests }`, OWNER).
- Tests: `requests off → 404` (page data fn and POST); on → creates pending request; approve creates customer + invite; manage routes in matrix.

### Task 6: Two-step sign-in (TOTP)
- Create: `lib/totp.ts` (`totp(secret: Buffer, time: number): string`, `verifyTotp(secretB32, code, now, window = 1): boolean`, base32 encode/decode), `api/account/two-step/{start,enable,disable}`, `api/auth/login/two-step/route.ts`; Modify: login route + form.
- Login: password OK + `totpEnabledAt` → no session; returns `{ twoStep: true, ticket }` (AuthToken purpose `two_step`, 5 min); POST code+ticket → session. Recovery codes (10, shown once) also accepted, each single-use.
- Tests: RFC 6238 SHA-1 vectors (secret "12345678901234567890", T=59 → 94287082 → 6-digit "287082"); `password alone does not sign in when two-step is on`; wrong code count limit; recovery code single use.

### Task 7: Platform admin
- Create: `app/admin/page.tsx` (list stores: name, address, status, owner email, created; Suspend/Reactivate), `api/admin/stores/[id]/route.ts` (PATCH status active|suspended, requires `session.isPlatformAdmin`), `scripts/make-admin.ts` + `npm run make-admin -- <email>`.
- Admin sees no orders/customers. Tests: non-admin → 404; admin suspends → store members get 404.

### Task 8: Gate and handoff
- `npm test`, `tsc`, `next build`, `npm audit` = 0, e2e (add: sign-up → verify via dev outbox printed link, forgot-password page renders, admin 404 for non-admin), docs (README, HANDOFF, roadmap), commit, push.
