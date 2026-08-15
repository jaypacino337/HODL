# A: ATTENTION MARKETS

**Attention is currency. Attention is power.**

A Bloomberg-style terminal for the attention economy, powered by its own
token's fees. The engine runs four loops, forever:

1. **CLAIM** — every 15 minutes, the coin's pump.fun creator fees are claimed
   into the treasury and split on a public ledger: **50% buybacks / 50%
   attention rewards**.
2. **SCAN** — every hour the Attention Scanner sweeps the markets: boosted
   DexScreener tokens, CoinGecko trending, news headlines, trend slots — and
   ranks everything by a composite attention score on the terminal.
3. **PAY** — post about the ticker on X, log the link in the terminal (one
   signed message, no gas), earn **attention points**. Every weekly epoch, the
   rewards pool pays contributors pro-rata by points, in SOL. Lifetime points
   track tier (**OBSERVER → SIGNAL → AMPLIFIER → OPERATOR → INSIDER**) and
   airdrop eligibility.
4. **MONETIZE** — projects buy ad slots on the terminal, paid in SOL, verified
   on-chain. Revenue splits **90% buybacks / 10% development**. Buybacks
   execute automatically on schedule.

## Stack

| Piece | Runs on | What it does |
|---|---|---|
| `packages/website` | **Vercel** | The terminal: scanner, flywheel, leaderboard, your-terminal, adspace, wire |
| `packages/engine` | **Railway** | Claims + splits fees, buybacks, scanner, points, epochs, ads, API |
| `supabase/` | **Supabase** | Public ledger: claims, buybacks, posts, epochs, payouts, ads, scans |

```
packages/
  shared/          config, types, signed-message formats
  fee-harvester/   claims pump.fun creator fees (bonding curve + PumpSwap)
  engine/          the four loops + terminal API        ← Railway
  website/         the terminal (Next.js + Tailwind)    ← Vercel
supabase/migrations/  full schema, RLS public-read
docs/              ARCHITECTURE · DEPLOYMENT · DISCLAIMER
```

## Quickstart (local, devnet)

```bash
npm install
cp .env.example .env             # mint, treasury keypair, Supabase creds, ADMIN_KEY
# run supabase/migrations/0001_init.sql in the Supabase SQL editor
npm run start:engine             # loops + API on :4000
npm run dev:website              # terminal on :3000
```

Production walkthrough: **`docs/DEPLOYMENT.md`**.

## Honesty notes

- The scanner's DexScreener + CoinGecko sources are live with no keys. News
  activates with `NEWS_API_KEY`; TikTok needs a trends provider plugged into
  one function (`scanner.ts`). The terminal displays each source's real
  status — nothing pretends to be live.
- X posts auto-verify (mention check + engagement-weighted points) when
  `X_BEARER_TOKEN` is set; otherwise submissions queue for manual review
  through the admin endpoint. No token, no honor-system points.
- Every claim, buyback, reward payout, and ad payment is an on-chain
  signature recorded in Supabase and printed on the Wire.
- "Airdrop eligibility" is tracked transparently and promised nowhere. Read
  `docs/DISCLAIMER.md` before going live.
