# THE BOARDROOM — Disclaimer & risk notes

**Read before deploying with real funds or launching $BOARD.**

## What this repository is

A working implementation of an AI-governed public treasury product: live
demo mode, a real orchestration engine, tested but **unaudited** contracts.
Nothing is deployed, no token exists, and no balances shown anywhere are
real unless the connected engine reads them from a chain.

## Legal / regulatory

Launching a token whose treasury is actively managed — by anyone or
anything — can implicate securities, commodities, investment-company and
money-transmission law depending on jurisdiction and design. "AI decided"
is not a legal defense; the operator remains responsible for every
execution. Airdrops, buybacks and stock-token exposure each carry their own
regulatory weight. **Get qualified counsel for every jurisdiction you'd
serve before going live.** Nothing in this repository is legal, financial or
investment advice; nothing is an offer to sell any instrument.

## Product honesty rules (enforced in code, keep them)

- Launch states derive from real configuration; the site never claims more.
- Demo data renders only under an explicit simulation banner, locally.
- Receipts are never simulated. No receipt, no execution — period.
- Holder voting is reported inactive until the snapshot system works.
- Locked agent allocations are governance alignment, **not** equity or
  company ownership, and the copy must never say otherwise.

## Technical risks

- Unaudited Solidity; model-driven proposals (bounded by policy, but models
  err); oracle/pricing inputs for non-USDG assets; keeper key compromise
  (mitigated, not eliminated, by on-chain limits); Robinhood Chain and Pons
  V2 are young infrastructure.

## Treasury risk

The board can be wrong in public. Treasuries can lose value. The permanent
reserve, caps and thresholds bound the blast radius — they do not remove it.
