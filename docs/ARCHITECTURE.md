# Architecture

```
                     ┌─────────────────────────────────────────────┐
                     │                 SOLANA                      │
                     │  pump.fun creator-fee vaults   game vault   │
                     │  (bonding curve + PumpSwap)    (SOL pot)    │
                     └────────▲───────────────▲──────────┬─────────┘
                              │ claim (15min) │ balances │ payouts
                              │               │          ▼
┌──────────────┐   HTTPS   ┌──┴───────────────┴─────────────────────┐
│   WEBSITE    │──────────▶│              GAME-WORKER               │
│   (Vercel)   │  /api/*   │              (Railway)                 │
│              │           │  cron: claim → settle → open round     │
│ wallet sign  │           │  API: state / history / pick           │
└──────────────┘           └──────────────────┬─────────────────────┘
                                              │ service-role writes
                                              ▼
                           ┌────────────────────────────────────────┐
                           │           SUPABASE (Postgres)          │
                           │ rounds · picks · payouts · fee_claims  │
                           │ views: round_summaries · leaderboard   │
                           └────────────────────────────────────────┘
```

## The 15-minute cycle (`game-worker/src/engine.ts`)

Every `ROUND_INTERVAL_MS` (default 15 min) the worker runs one tick:

1. **CLAIM** — `harvestPumpFunCreatorFees()` checks both creator-fee vaults
   (bonding-curve PDA pre-graduation, PumpSwap PDA post-graduation) and
   claims anything accrued. Fees land as SOL in the game vault, which is the
   coin's creator wallet. Each claim is logged to `fee_claims`.
2. **SETTLE** — for the round whose `settles_at` has passed:
   - Pot = vault balance − `VAULT_RESERVE_LAMPORTS` (rollover included).
   - Fetch a **finalized blockhash**; `sha256(blockhash | round-N)[0]`
     even → HODL, odd → NO HODL. Stored on the round row for public audit.
   - Re-fetch each picker's live token balance. Below the 1M threshold →
     pick voided. Otherwise the balance is the player's **weight**.
   - Winners = pickers on the winning side; each gets
     `pot × weight / totalWinnerWeight`, sent as batched SOL transfers
     (10 per tx). Results land in `payouts` with tx signatures.
   - No winners → nothing sent; the pot stays in the vault and rolls over.
3. **OPEN** — insert the next round (`locks_at` = `settles_at` − 30s).

A 30-second watchdog also settles overdue rounds after restarts, so a
Railway redeploy mid-round never wedges the game.

## Picks are signed messages, not transactions

The website asks the connected wallet to `signMessage()` the canonical
string from `@hodl/shared`'s `pickMessage()`:

```
HODL OR NO HODL | round 42 | pick HODL | wallet <base58>
```

`POST /api/pick` re-derives that exact string and verifies the ed25519
signature against the claimed pubkey (tweetnacl), so nobody can pick on
behalf of a wallet they don't control. The worker then checks the wallet's
live token balance against `MIN_HOLD_TOKENS` before accepting. Picks
upsert — players can flip sides freely until `locks_at`.

Playing is therefore free (no gas), can't move funds, and requires no
approvals — the only on-chain movement is the worker paying winners.

## Why the flip can't be gamed

- Players can't game it: picks lock 30s before settlement, and the deciding
  blockhash doesn't exist yet at lock time.
- The operator *could* delay settlement fishing for a favorable hash —
  which is why the blockhash is stored and the settle time is public; any
  tampering is visible as a late settle. For stronger guarantees, swap in a
  VRF (e.g. Switchboard) — the seam is `decideWinningSide()`, one function.

## Data model (Supabase)

| Table | Purpose |
|---|---|
| `rounds` | one row per round: timing, status, pot, winning side, decision blockhash |
| `picks` | PK `(round_id, wallet)`: side, balance at pick, signature |
| `payouts` | winner, weight, amount, payout tx signature, sent/failed |
| `fee_claims` | every creator-fee claim with tx signature |

Views `round_summaries`, `leaderboard`, `game_totals` pre-aggregate what
the API serves. RLS: everything world-readable; only the worker's
service-role key writes. Token amounts are `numeric` (SPL u64 can overflow
signed bigint).

## Trust model

Custodial by design for v1: the creator wallet is the vault and the worker
signs payouts. Every fee claim and payout is an on-chain signature recorded
in Supabase and rendered on the site, so operators can be audited. The
serverless-free worker (one Railway service) keeps ops surface minimal.
