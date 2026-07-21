# Deployment — Supabase → Railway → Vercel

Deploy in this order; each step feeds the next its config.

## 0. Prerequisites

- The coin exists on pump.fun and you control the **creator wallet's**
  keypair JSON (the wallet that launched the coin — creator fees are keyed
  to it; no other wallet can claim them).
- That wallet holds ~0.05 SOL for transaction fees.
- Node 18.18+ locally, repo cloned, `npm install` run once.

## 1. Supabase (database)

1. [supabase.com](https://supabase.com) → **New project** (any region, free tier is fine).
2. SQL Editor → paste the whole of `supabase/migrations/0001_init.sql` → **Run**.
3. Settings → API, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never in the website)

## 2. Railway (game-worker)

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → pick this repo.
2. Service settings:
   - **Build command**: `npm install && npm run build --workspace packages/shared --workspace packages/fee-harvester`
   - **Start command**: `npm run start --workspace packages/game-worker`
   - (Or just let it pick up `packages/game-worker/railway.json`.)
3. Variables — copy from `.env.example` and fill in:
   - `RPC_URL` — a real RPC (free [Helius](https://helius.dev) endpoint recommended; public mainnet RPC will rate-limit the balance checks)
   - `MINT_ADDRESS` — your coin's mint
   - `GAME_VAULT_KEYPAIR` — paste the **raw JSON array** from the creator wallet's keypair file (`[12,34,...]`)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from step 1
   - `CORS_ORIGINS` — your site's domain once you have it, e.g. `https://www.hodlornohodl.fun`
   - Optional: install the pump.fun SDKs the harvester calls:
     they're required at runtime for the actual claim —
     `npm i @pump-fun/pump-sdk @pump-fun/pump-swap-sdk -w packages/game-worker`
     (committed to package.json is fine too; they're kept out by default so
     the build doesn't depend on pump.fun's release cadence).
4. Settings → Networking → **Generate Domain**. Note the URL — that's your API.
5. Check logs: you should see `opened round #1` and `API listening`.
   `GET https://<railway-domain>/health` → `{"ok":true}`.

## 3. Vercel (website)

1. [vercel.com](https://vercel.com) → **Add New Project** → import this repo.
2. **Root Directory**: `packages/website` (Framework: Next.js, auto-detected).
3. Environment variables (all three from `packages/website/.env.example`):
   - `NEXT_PUBLIC_API_URL` = the Railway domain from step 2.4 (https, no trailing slash)
   - `NEXT_PUBLIC_RPC_URL` = same RPC family as the worker
   - `NEXT_PUBLIC_MINT_ADDRESS` = your mint
4. Deploy. Point your domain (e.g. `www.hodlornohodl.fun`) at the Vercel
   project, then go back to Railway and set `CORS_ORIGINS` to that domain.

## 4. Smoke test (do this on devnet first)

1. Worker logs show a cycle every 15 minutes: claim (probably "no creator
   fees" on devnet), settle, open.
2. Site loads, wallet connects, pot and countdown render.
3. With a wallet holding ≥ `MIN_HOLD_TOKENS`: pick a side → wallet prompts
   for a **message signature** (not a transaction) → "Locked in" appears,
   and the row shows up in Supabase → `picks`.
4. With a small wallet: pick is rejected with the 500K message.
5. After the flip: round appears in "Recent flips", payout SOL arrives,
   `payouts` row has the tx signature.

## Going to mainnet

- Switch `RPC_URL`/`NEXT_PUBLIC_RPC_URL` to mainnet endpoints.
- `EXCLUDED_OWNERS`: add the bonding-curve/AMM pool address, your treasury,
  and any CEX wallets — anything that holds tokens but shouldn't play.
- Fund the vault with a little extra SOL so the first rounds can pay even
  before fees accrue (optional but a dead pot on day one is a bad look).
- Read `docs/DISCLAIMER.md`. Seriously.

## Ops notes

- **Restarts are safe**: rounds/picks live in Supabase; a watchdog settles
  any overdue round on boot.
- **Vault runs dry?** Payouts fail, get recorded as `failed`, and the game
  keeps going — the pot rebuilds from the next fee claim.
- **Rotating the vault**: not possible — creator fees are bound to the
  coin's creator wallet forever. Guard that keypair.
