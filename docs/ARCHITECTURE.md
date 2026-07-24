# OVERBID — Architecture

## System at a glance

```
                        ┌───────────────────────────┐
                        │   packages/website        │  Vercel
                        │   Next.js · launch board  │
                        │   demo AMM = shared math  │
                        └─────┬──────────────┬──────┘
                 read API     │              │ (live mode, later)
                              ▼              ▼
        ┌──────────────────────────┐   ┌────────────────────────────┐
        │ packages/oracle-worker   │   │ packages/contracts         │
        │ Railway · Express API    │   │ Robinhood Chain (Orbit L2) │
        │ Parcl Labs poller        │   │ HousePool · MarketFactory  │
        │ settlement computation   │──▶│ OverbidMarket · IndexOracle│
        └───────────┬──────────────┘   └────────────────────────────┘
                    ▼
        ┌──────────────────────────┐
        │ supabase/ (Postgres)     │
        │ feeds · observations ·   │
        │ markets · settlements    │
        └──────────────────────────┘
```

One shared source of truth — `packages/shared` — holds the market
definitions, the AMM math, and the fee constants. The website's paper-trading
demo, the worker's settlement engine, and the Solidity contracts all
implement/consume the same definitions, so demo behavior is contract behavior.

## The market maker

Markets use an **n-outcome fixed-product AMM** (Gnosis FPMM — the design
early Polymarket markets ran on):

- Invariant: `∏ pools[i] = k` over the AMM's per-outcome share inventory.
- Buying outcome *i* with `a` USDG (post-fee) mints a **complete set** —
  1 share of *every* outcome per USDG, fully collateralized — adds it to all
  pools, then pays out outcome-*i* shares to restore the invariant.
- Implied probability of outcome *i* is proportional to `1 / pools[i]`; a 29¢
  price *is* a 29% implied probability, and one winning share always redeems
  1 USDG.

Why FPMM over LMSR or an order book: no `exp/ln` fixed-point math on-chain,
liquidity is a first-class deposit (complete sets), and n-outcome support is
native — a five-city race is the flagship product.

`packages/shared/src/amm.ts` is the reference implementation (the website
runs it in the browser); `packages/contracts/src/OverbidMarket.sol` mirrors
it with the same iterative ceil-div formulation Gnosis used to avoid
overflow.

## Settlement

Every market's rule is fixed at creation and machine-checkable:

| Rule | Meaning |
|---|---|
| `max-gain` | one index feed per outcome; largest % change over the window wins (falling less counts) |
| `positive` | binary; YES iff the metric change > 0 |
| `threshold` | binary; YES iff the metric change ≥ `thresholdPct` |

The oracle worker pulls Parcl Labs price feeds on a schedule, stores every
observation in Postgres, and when a market's window has elapsed computes the
winner from the **stored series** (anchor = last observation at or before the
window boundary). On-chain, the same values are posted to `IndexOracle` so a
resolution is auditable against the posted series.

**Oracle trust model (v1):** allow-listed poster, everything on the record.
Decentralizing it — multiple posters, dispute window — is the roadmap step
after launch. This is a deliberate v1 trade: transparent-but-trusted beats
pretend-decentralized.

**Data coverage:** Parcl Labs covers US markets, which is why v1 is US-only
(Miami, New York, Austin, Phoenix, Chicago, national aggregate). A non-US
city (Toronto first) requires a licensed local index provider wired in as a
second adapter behind the same `Feed` interface — a market is only listable
if its feed is servable.

## Contracts

- **`OverbidMarket`** — one market: pools, buy/sell with slippage guards,
  2% fee accrual, oracle-only `resolve`, 1:1 `redeem`, and
  `sweepResidualToPool` returning leftover inventory to the House Pool.
- **`HousePool`** — minimal ERC-4626-style vault (`ovLP`). Tracks
  `deployedAssets` so seed capital stays part of `totalAssets` while a market
  is live. Fees and residuals arrive as plain transfers → share price rises.
- **`MarketFactory`** — the only market creator. Templates (settlement rule +
  data-source requirement) are approved by governance; `createProtocolMarket`
  draws seed from the pool and names the pool as creator;
  `createMarket` lets anyone launch from a template with their own seed.
- **`IndexOracle`** — on-chain observation ledger + market resolution.

## Website

Next.js 14 App Router, Tailwind, zero required env vars. The demo store
(`lib/store.ts`) keeps 10,000 paper USDG, live FPMM state per market, and a
demo LP position in `localStorage`; server and first client render use the
pristine seeded state so hydration is deterministic. `NEXT_PUBLIC_API_URL`
switches data reads to the oracle worker; wallet + on-chain trading arrive
with the Robinhood Chain deployment.

## Why this stack

Same three-service shape that shipped before (Vercel + Railway + Supabase):
cheap, boring, debuggable. Everything stateful is Postgres; everything
user-facing is static-friendly; the only always-on process is the worker.
