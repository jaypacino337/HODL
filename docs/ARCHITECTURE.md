# Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │                  SOLANA                      │
                    │ pump.fun fee vaults · treasury · buy txs     │
                    └──────▲──────────▲──────────┬───────────┬─────┘
                     claim │ verify   │ payments │ buybacks  │ reward payouts
                           │          │          ▼           ▼
┌──────────────┐  HTTPS  ┌─┴──────────┴────────────────────────────┐
│   TERMINAL   │────────▶│                ENGINE                   │
│   (Vercel)   │  /api/* │               (Railway)                 │
│  wallet sign │         │ 15m claim+split · 1h scan · 4h buyback  │
└──────────────┘         │ weekly epoch payout · ads · points API  │
                         └───────────────────┬─────────────────────┘
        DexScreener · CoinGecko ─────────────┤ service-role writes
        news API · X API (keyed) ────────────┤
                                             ▼
                        ┌─────────────────────────────────────────┐
                        │            SUPABASE (Postgres)          │
                        │ fee_claims · ledger · buybacks · scans  │
                        │ social_posts · epochs · payouts · ads   │
                        └─────────────────────────────────────────┘
```

## The four loops (`engine/src/engine.ts`)

**CLAIM (15 min).** `harvestPumpFunCreatorFees()` claims both creator-fee
vaults (bonding curve pre-graduation, PumpSwap after). Each claim is split
on the `ledger`: `FEE_BUYBACK_SHARE` (50%) credited to the buyback pool,
the remainder credited to the open epoch's rewards pool. One treasury
wallet, pure accounting — pools can never spend money that isn't there.

**SCAN (1 h).** `scanner.ts` sweeps sources in parallel and stores a ranked
scan. DexScreener boosts (enriched with live pair price/volume) and
CoinGecko trending run keyless; news lights up with `NEWS_API_KEY`; TikTok
is a one-function adapter awaiting a trends provider. Composite score 0-100
blends source rank and 24h volume. Source statuses are stored with every
scan and shown on the terminal.

**BUYBACK (4 h).** Spends `min(buyback pool, treasury - reserve)` buying
the token — bonding-curve buy pre-graduation, PumpSwap after (SDKs resolved
at runtime, like the fee claim). Failures and missing SDKs are recorded as
`failed`/`skipped` rows; funds stay pooled. Optionally `BURN_BUYBACKS`.

**EPOCH (weekly).** At epoch end the rewards pool pays out pro-rata by
approved attention points that epoch (batched SOL transfers, dust
threshold), the epoch is marked paid, the next one opens. No approved
points → the pool rolls forward.

## Attention points

`POST /api/attention/submit` takes `{wallet, url, signature}` where the
signature is the wallet's ed25519 signature over the canonical string in
`@attn/shared` — nobody can farm points for wallets they don't control.
URLs must be real `x.com/<user>/status/<id>` links and are unique — one
submission per post, ever.

With `X_BEARER_TOKEN`: the engine reads the tweet via the X API, checks it
actually mentions the ticker, and scores `100 + 2×likes + 5×reposts +
3×replies` (cap 10,000) — auto-approved or auto-denied with the reason
stored. Without: posts sit `pending` for the admin review endpoint
(`x-admin-key` header). Tiers are lifetime-point thresholds; the terminal
labels them as airdrop *eligibility tracking*, never a promise.

## Ads

`POST /api/ads/book` (signed) prices `days × AD_PRICE_LAMPORTS_PER_DAY`
and returns the treasury address. The buyer pays from any wallet and
confirms with the transaction signature; `payments.ts` verifies on-chain
that the treasury's balance actually increased by the price in that exact
transaction (signature reuse is blocked). On activation the revenue splits
on the ledger: 90% buyback pool, 10% dev pool. Ads expire automatically;
an admin endpoint can reject content. Ad links render with
`rel="nofollow sponsored"`.

## Data model

| Table | Purpose |
|---|---|
| `fee_claims` | every creator-fee claim + tx signature |
| `ledger` | signed pool movements (buyback/rewards/dev) — pools are `sum(lamports)` |
| `buybacks` | each execution: spent, tx, sent/failed/skipped + note |
| `epochs`, `epoch_payouts` | weekly reward cycles and who got paid what |
| `social_posts` | submissions, verification status, points |
| `ads` | bookings, payment signature, run window |
| `scans`, `scan_items` | every scanner sweep, ranked |

RLS: world-readable, service-role writes. Views `attention_leaderboard`
and `platform_totals` pre-aggregate for the API.

## Trust model

Custodial v1: the creator wallet is the treasury and the engine signs
everything. In exchange, everything is receipts: claims, buybacks, payouts
and ad payments all carry tx signatures stored publicly, and the 50/50 &
90/10 splits are enforced in one place (`ledger`) that anyone can audit.
