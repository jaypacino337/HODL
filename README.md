# 🏘️ OVERBID

**Trade where housing goes next.**

A real-estate prediction market: every outcome — *“Which housing market rises
most in 2026: Miami, New York, Austin, Phoenix, or Chicago?”*, *“Austin beats
Phoenix this quarter?”*, *“Manhattan rent growth positive this month?”* — is a
share you can buy and sell. At settlement, the housing index decides: winning
shares redeem the collateral at 1 USDG each.

```text
USDG → buy city-outcome shares → House Pool liquidity enables trading
     → 2% fees → 70% LPs · 10% creator · 20% treasury
     → index settlement (Parcl Labs) → winning shares redeem 1:1
```

## The pitch, in four decisions

1. **Prediction markets first, perps later.** City-race and yes/no markets
   need only an index reading and a date. Perpetual long/short markets on city
   indexes come once there's index history, users, and liquidity depth.
2. **LP shares, not a revenue token.** The House Pool is the “holders get a
   piece” mechanism: LPs deposit USDG, seed every market, earn 70% of trading
   fees plus settlement residuals — and carry the market risk that earns it.
3. **The protocol funds the first five markets** from approved templates, and
   because they're protocol-created, their 10% creator-fee cut routes straight
   back into the House Pool — creator fees fund the liquidity pool.
4. **Built for Robinhood Chain.** Contracts target the Arbitrum Orbit L2 with
   USDG (Global Dollar) collateral; they run unchanged on Arbitrum Sepolia
   today. US-only data in v1 (Parcl Labs); Toronto and other non-US cities
   wait on a licensed local index provider.

## Monorepo

| Piece | Runs on | What it does |
|---|---|---|
| `packages/website` | **Vercel** | Next.js site — the launch board, live trading demo (real FPMM math, paper USDG), House Pool page |
| `packages/contracts` | **Robinhood Chain / Arbitrum** | `OverbidMarket` (n-outcome fixed-product AMM), `HousePool` (LP vault), `MarketFactory` (approved templates), `IndexOracle` |
| `packages/oracle-worker` | **Railway** | Pulls Parcl Labs index data, keeps the ledger, computes settlements, serves the read API |
| `packages/shared` | everywhere | Types, AMM math (the same math the contracts implement), the five launch-market definitions |
| `supabase/` | **Supabase** | Postgres ledger: index feeds, observations, markets, settlements (RLS: public read, service-role write) |

## Deploy the website to Vercel (one click)

The site needs **zero configuration**: import this repo into Vercel and ship.
The root `vercel.json` points the build at `packages/website`; no environment
variables are required for demo mode. (Alternative: set the project's Root
Directory to `packages/website`.)

## Quickstart (local)

```bash
npm install
npm run dev:website        # site on :3000 — full demo, no env needed
npm run start:oracle       # oracle worker API on :4000 (env optional)
```

Full production walkthrough (Supabase → Railway → Vercel → contracts):
**`docs/DEPLOYMENT.md`** · Economics: **`docs/ECONOMICS.md`** · Design:
**`docs/ARCHITECTURE.md`**

## The five launch markets

| Market | Type | Settles |
|---|---|---|
| Hottest housing market of 2026 (Miami·NY·Austin·Phoenix·Chicago) | city race, biggest % index gain wins | Jan 2027 |
| Austin vs Phoenix — Q3 head-to-head | 2-way, better % change wins | Oct 2026 |
| Manhattan rent growth positive in August? | yes/no on the rental index | Sep 2026 |
| Miami up 5%+ in 2026? | yes/no threshold | Jan 2027 |
| US housing up this quarter? | yes/no on the national index | Oct 2026 |

Each is seeded with $10K of House Pool liquidity and settles against Parcl
Labs price feeds ([docs.parcllabs.com](https://docs.parcllabs.com/)).

## Status

Working demo + compile-clean reference implementation. **Not** a deployed,
funded market: contracts are unaudited, no real funds move anywhere, and
prediction markets carry serious legal/regulatory weight — read
`docs/DISCLAIMER.md` before taking any of this toward production.
