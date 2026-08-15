# Read before going live

This repo is a working reference implementation. Deploying it for real
people and real money is **your** decision and responsibility.

## Buyback marketing is securities bait

"Hold the token; fees and revenue buy it back on a schedule" is precisely
the kind of value-accrual language securities regulators quote back at
projects. How you market this matters as much as how it works. Get real
legal advice before launch, not after.

## Paying people to post is regulated

The attention-rewards loop pays people for promoting a tradeable asset.
In the US that triggers disclosure obligations (FTC endorsement rules; and
for securities, §17(b) "touting" liability applies to paid promotion that
isn't disclosed). The terminal's public leaderboard helps, but the people
posting must disclose they're compensated. Undisclosed shill armies are
how projects and promoters both get charged.

## Airdrop language

The terminal deliberately says "eligibility tracking — never a promise."
Keep it that way everywhere you communicate. Promising a future token
distribution creates both expectations and legal exposure; walking back a
promised airdrop after people worked for points is how communities die and
lawsuits start.

## Ads are publisher liability

You're selling ad space with no review before payment. The admin reject
endpoint exists — use it. Scam links, impersonation, and malware in your
ad slots become your problem reputationally and possibly legally. Consider
pre-moderation (flip the flow: approve, then charge).

## Custody and key risk

The creator wallet is the treasury: fees, buyback pool, rewards pool, ad
revenue — one keypair, sitting in Railway env vars. Anyone with project
access holds the bankroll. Minimal collaborator access; sweep excess to
cold storage; the creator wallet itself can never be rotated.

## Dependency honesty

pump.fun's SDKs and fee program are theirs to change (they've shipped
breaking changes before). The scanner leans on free public APIs
(DexScreener, CoinGecko) with no SLA. The engine degrades gracefully —
skipped buybacks, source status flags — but "degraded and honest" still
needs you watching the logs.

## Operational honesty

The site advertises exact splits (50/50 fees, 90/10 revenue) and prints
every movement with tx signatures. Quietly diverging from advertised
splits while collecting ad money and promotion labor is fraud in most
places. Keep the ledger truthful.
