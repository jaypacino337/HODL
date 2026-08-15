# Deployment — Supabase → Railway → Vercel

Deploy in this order; each step feeds the next its config.

## 0. Prerequisites

- The coin exists on pump.fun and you control the **creator wallet's**
  keypair JSON (creator fees are keyed to it; no other wallet can claim).
- That wallet holds ~0.1 SOL for transaction fees.
- Node 18.18+, repo cloned, `npm install` run once.

## 1. Supabase (database)

1. [supabase.com](https://supabase.com) → **New project**.
2. SQL Editor → paste all of `supabase/migrations/0001_init.sql` → **Run**.
3. Settings → API, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

## 2. Railway (engine)

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Build command: `npm install && npm run build --workspace packages/shared --workspace packages/fee-harvester`
   Start command: `npm run start --workspace packages/engine`
   (or let it pick up `packages/engine/railway.json`).
3. Variables — copy `.env.example` and fill in:
   - `RPC_URL` — real RPC (free [Helius](https://helius.dev) key recommended)
   - `MINT_ADDRESS`, `TICKER`
   - `TREASURY_KEYPAIR` — the creator wallet's raw JSON array `[12,34,...]`
   - `DEV_WALLET` — where the 10% development share goes
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_KEY` — long random string; it guards post/ad review
   - Optional but recommended:
     - `X_BEARER_TOKEN` — X API v2 token → auto-verified, engagement-weighted points
     - `NEWS_API_KEY` — newsapi.org → news source live on the scanner
     - `npm i @pump-fun/pump-sdk @pump-fun/pump-swap-sdk -w packages/engine`
       → real fee claims and buyback execution (without them those steps
       log+record `skipped` and funds stay pooled)
4. Networking → **Generate Domain** → that's the API. `GET /health` → `{"ok":true}`.
5. Logs should show the four loops arming and a first scan storing items.

## 3. Vercel (terminal)

1. **Add New → Project** → import the repo.
2. **Root Directory**: `packages/website`.
3. Env vars: `NEXT_PUBLIC_API_URL` (Railway domain), `NEXT_PUBLIC_RPC_URL`,
   `NEXT_PUBLIC_MINT_ADDRESS`.
4. Deploy, point your domain, then set `CORS_ORIGINS` on Railway to it.

## 4. Smoke test

1. Terminal loads; scanner fills within the hour (immediately after engine
   boot, in practice); tape scrolls; source status row shows
   dexscreener/coingecko **live**.
2. Connect a wallet → Your Terminal opens → submit an X post link → wallet
   prompts for a **message signature** → row appears in Supabase
   `social_posts` (auto-approved if `X_BEARER_TOKEN` is set, else pending).
3. Approve pending posts:
   `curl -X POST <api>/api/admin/review-post -H 'x-admin-key: …' -H 'content-type: application/json' -d '{"id":1,"action":"approve","points":250}'`
4. Book a test ad for 1 day → pay the quoted SOL to the treasury → confirm
   with the tx signature → ad renders in Adspace; `ledger` shows the 90/10
   split.
5. After fees accrue: Wire prints claims every 15 min, the buyback pool
   arms, and a buyback executes on the next 4h tick.

## Ops notes

- **Restarts are safe** — all state lives in Supabase; epochs/pools resume.
- **Buyback prerequisites missing?** Executions record `skipped` and the
  pool keeps growing; nothing is lost.
- **Epoch pays nothing?** No approved points that week — the pool rolls
  into the next epoch automatically.
- Guard `TREASURY_KEYPAIR` and `ADMIN_KEY` like the bankroll they are.
