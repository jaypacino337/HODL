# OVERBID — Disclaimer & risk notes

**Read this before deploying any of this code with real funds.**

## What this repository is

A working demo and reference implementation of a real-estate prediction
market. The website is paper trading only: demo balances, no wallets, no real
funds, no chain writes. The Solidity contracts are **unaudited** reference
code.

## Legal / regulatory

Prediction markets are regulated financial activity in most jurisdictions
(commodities, gaming, or securities law, depending on design and venue —
e.g. CFTC jurisdiction in the US). Operating one for real money without
appropriate authorization can be a crime. Housing-index derivatives may also
implicate additional rules. **Get qualified legal advice for every
jurisdiction you'd serve before going live.** Nothing in this repository is
legal, financial, or investment advice; nothing here is an offer to trade.

## Data licensing

Parcl Labs (and any index provider) data is licensed. Using index data to
settle financial contracts typically requires a commercial license — the
public API terms are not automatically enough. Secure data agreements before
launch. Non-US indexes (e.g. Canada for Toronto) require their own licensed
providers.

## Economic risks

- **LPs can lose money.** The House Pool underwrites markets; when traders
  price outcomes better than the AMM, redemptions exceed seed + fees.
- **Oracle trust.** v1 settlement relies on an allow-listed poster. It is
  auditable, not trustless.
- **Smart-contract risk.** Unaudited code, fixed-point arithmetic, adversarial
  MEV environment. Audit before mainnet.
- **Index risk.** Housing indexes revise, lag, and can be discontinued;
  settlement rules must handle provider outages (the current code retries and
  anchors to last-available observations — review whether that policy fits a
  regulated deployment).

## Branding

"Robinhood", "Robinhood Chain", "USDG"/"Global Dollar", and "Parcl" are
trademarks of their respective owners. This is an independent project that
targets compatible infrastructure; nothing here implies endorsement by or
affiliation with any of them.
