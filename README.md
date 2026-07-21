# 💼 HODL OR NO HODL

**The on-chain game show. Every 15 minutes, the fees fund the pot — pick a side and win it.**

This is the full working implementation of [hodlornohodl.fun](https://www.hodlornohodl.fun):
a Solana game where the token *plays itself*:

1. **CLAIM** — every 15 minutes the game claims the coin's pump.fun **creator fees** into the game vault. Trading volume is the prize pool; nobody deposits anything.
2. **QUALIFY** — anyone holding **500,000+ tokens** can play each round, free. A pick is a signed message: no transaction, no gas.
3. **PICK** — choose your case: **HODL** or **NO HODL**. Switch any time until the round locks (30s before the flip).
4. **FLIP** — at the buzzer a fresh finalized Solana blockhash decides the winning side. The blockhash is stored with the round so anyone can recompute the result.
5. **PAY** — winners split the entire pot **pro-rata by how much they hold** (your bag is your score), paid instantly in SOL. If nobody picked the winning side, the pot rolls over and grows.

## Stack

Exactly three services, as designed:

| Piece | Runs on | What it does |
|---|---|---|
| `packages/website` | **Vercel** | Next.js site — wallet connect, pick UI, live pot, countdown, leaderboard |
| `packages/game-worker` | **Railway** | The 15-minute engine: fee claim → settle → payout → next round, plus the game API |
| `supabase/` | **Supabase** | Postgres ledger of every round, pick, payout, and fee claim (RLS: public read, service-role write) |

```
packages/
  shared/          env config, shared types, the signed pick-message format
  fee-harvester/   claims pump.fun creator fees (bonding curve + PumpSwap AMM)
  game-worker/     round engine + payouts + Express API  ← deploy to Railway
  website/         Next.js + Tailwind game site           ← deploy to Vercel
supabase/
  migrations/      schema: rounds, picks, payouts, fee_claims + views
docs/
  ARCHITECTURE.md  data flow and design decisions
  DEPLOYMENT.md    step-by-step: Supabase -> Railway -> Vercel
  DISCLAIMER.md    legal / risk notes — read before going live
```

## Quickstart (local, devnet)

```bash
npm install
cp .env.example .env                     # fill in mint, vault keypair, Supabase creds
# run supabase/migrations/0001_init.sql in your Supabase SQL editor
npm run start:worker                     # engine + API on :4000
npm run dev:website                      # site on :3000, in another shell
```

Full production walkthrough: **`docs/DEPLOYMENT.md`**.

## How the money flows

pump.fun shares trading fees with the wallet that created a coin, claimable
any time via a permissionless instruction. The game vault **is** that creator
wallet: fees claim straight into it, the pot is its balance (minus a small
fee reserve), and winner payouts are plain SOL transfers out of it. One
wallet, fully auditable on-chain — every claim and payout signature is also
written to Supabase and shown on the site.

## Fairness

The flip is `sha256(blockhash | round-N)` — first byte even → HODL, odd →
NO HODL — using a **finalized blockhash fetched at settlement**, a value
that does not exist when picks lock 30 seconds earlier. Every settled round
stores its blockhash, so the result is recomputable by anyone.

## Status

Complete reference implementation, tested to compile and run — but not a
deployed, funded, live game until *you* deploy it. Read `docs/DISCLAIMER.md`
(this is a game of chance funded by memecoin fees — know your local rules)
before pointing it at mainnet.
