# ReorderPal: read this first

Claude Code loads this file automatically. Full context lives in **HANDOFF.md**: read it before doing
anything, and keep it up to date at the end of every piece of work (what changed, what's next).

## The product
- **ReorderPal** (domain **reorderpal.com**, bought by the owner on 2026-11-07 at Cloudflare). Name set in `lib/brand.ts`.
- A store builder for **any seller** (produce wholesalers, lamp makers, any niche). Each seller gets their
  own separate store; their business customers order from their phone instead of calling; **every order
  becomes a QuickBooks Online invoice**. Sellers pay a monthly fee; their customers use it free.
- Plan: live on reorderpal.com, then the **QuickBooks App Store**, later phone app stores.

## How the owner wants to work (don't make them repeat this)
- Plain language, step by step, short. No fluff, no made-up facts; if something isn't tested, say so.
  Check facts (Intuit rules, prices, availability) with a search instead of guessing.
- Keep going until the job is finished; split big work into phases that end tested, committed and pushed.
- When something is ready to look at, **start the site and show it** (preview on port 3000 and/or
  screenshots sent with SendUserFile). The owner can't open `localhost` from their phone.
- Design: simple, light, neat, "fresh market" feel; nothing dark, futuristic, cluttered or off the page.
  Every seller can personalize their store (4 looks + accent color + logo/banner), never with custom code.
- Security is required: store isolation on every request, no secrets in the browser, server-side sessions,
  never commit `.env`, databases or `uploads/`.
- Budget-conscious (e.g. domain under $20). Ask before anything that costs money.

## Where things are
- Repo `wj5cszypyz-wq/app`. Current work: branch `claude/loving-fermi-42tguu` (not merged to `main` yet).
- Spec: `docs/superpowers/specs/2026-11-07-multi-niche-stores-design.md`; roadmap and phase plans in
  `docs/superpowers/plans/`.
- Checks before every push: `npm test`, `npx tsc --noEmit`, `npx next build`, `npm audit` (0), and with
  `npm run dev` running, `node tests/e2e/isolation.e2e.mjs`.
- Never run `prisma db push --force-reset` (blocked for AI agents). To rebuild the local demo database,
  delete `prisma/dev.db`, then `npx prisma db push` and `npx tsx prisma/seed.ts`.
