# ▄▖MEMESCAN

**Narrative radar + rug/scam scanner for the memecoin trenches.**

Answers two questions:

1. **What metas are running right now?** Pulls the currently-promoted token
   set from DexScreener (profiles + boosts), clusters names/descriptions into
   narratives — dog szn, AI agents, the regular-guy/*jimothy* character meta,
   etc. — and **discovers emergent metas automatically**: any word shared by
   3+ trending tokens becomes a cluster, so a brand-new meta shows up on the
   board before it has a name.
2. **Which of these launches are set up to rug?** Every token gets a red-flag
   score (0–100) from liquidity depth, FDV/liquidity ratio, pair age vs pump
   shape, buy/sell flow (dumps and honeypot patterns), paid boosts, missing
   socials, major-ticker impersonation, copycat swarms — plus on-chain
   findings from RugCheck for Solana mints (mint authority, LP lock, holder
   concentration).

No API keys needed — DexScreener and RugCheck endpoints are public.

## Run it

```bash
npm install                     # from the repo root

npm run memescan                # scan the live trending set
npm run memescan -- --query jimothy    # scan one idea/narrative
npm run memescan -- --demo      # bundled fictional snapshot, works offline
npm run memescan -- --md        # also write reports/scan-<ts>.md
npm run memescan -- --json      # raw ScanResult JSON

npm run memescan:web            # dark dashboard on http://localhost:5150
```

If the live APIs are unreachable, the CLI falls back to the bundled **demo
snapshot** (clearly labeled, all tokens fictional) so you can always see how
the output reads. Use `--live-only` to fail instead.

## What the verdicts mean

| Score | Verdict | Read as |
|---|---|---|
| 70+ | `AVOID` | Multiple hard red flags stacked — the classic rug setup |
| 45–69 | `HIGH RISK` | Serious flags; assume you're exit liquidity |
| 25–44 | `SKETCHY` | Enough smoke to stay away without more digging |
| 10–24 | `DYOR` | Normal early-memecoin jank |
| <10 | `LOOKS CLEANER` | Fewest red flags in this set — **not** an endorsement |

## Honest limitations

- These are **heuristics** on public market data. They catch the common rug
  shapes (thin pool + vertical day-one pump + paid boost + no socials), not a
  determined scammer, and a clean score proves nothing.
- Narrative clustering is text-based; a token named after a meta it isn't
  part of will land in the wrong bucket.
- Nothing here is financial advice. The modal memecoin outcome is zero.
