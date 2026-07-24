# OVERBID — Economics

## Principles

1. **The people who fund the market get the piece.** No general token whose
   holders skim protocol revenue while contributing nothing. The economic
   instrument is the **House Pool LP share (`ovLP`)**: LPs supply the USDG
   that makes markets tradable, so LPs earn most of the fees — and carry the
   market risk that justifies them.
2. **Creator fees fund the liquidity pool.** The first five markets are
   protocol-created, so their creator cut routes back into the House Pool.
3. **Fees are the only rake.** Odds are fair AMM odds; the protocol takes no
   hidden edge in pricing.

## Fee flow

Every buy and sell pays a **2% fee in USDG**, split on-chain by the market
contract:

| Share | Recipient | Why |
|---|---|---|
| **70%** | House Pool LPs | They seed every market and absorb the variance when traders beat the AMM. Also receive settlement residuals (leftover AMM inventory converts to USDG at resolution). |
| **10%** | Market creator | Launch a market from an approved template, earn a cut of its volume. For protocol-created markets the creator **is** the House Pool → this cut funds liquidity. |
| **20%** | Protocol treasury | Seeds new markets, pays oracle + index-licensing costs, funds the early points/rewards program. |

## LP economics, honestly stated

Sources of LP return:

- 70% of all trading fees, pro-rata to `ovLP`
- creator cut of protocol-launched markets (all five at launch)
- settlement residuals swept back from resolved markets

Sources of LP loss:

- **Adverse selection**: when the crowd prices an outcome better than the
  AMM, winners' redemptions exceed what the pool put in plus fees earned.
  This is the classic prediction-market LP risk; fees are the compensation.
- Idle-capital opportunity cost while seeds are deployed.

`ovLP` is explicitly **not** a savings product. TVL growth, fee volume, and
seed sizing determine whether LPs come out ahead; the parameters (2% fee,
70/10/20 split, $10K seeds) are launch settings, expected to be tuned.

## The first five markets

Funded with **$50,000** of House Pool capital ($10K each), created from
approved templates, settling on Parcl Labs indexes. They exist to prove the
loop: seed → trade → settle → residual + fees home to the pool.

## Creators

Anyone can launch a market **from an approved template only** — a settlement
rule plus a data source the oracle can actually serve. That policy is what
keeps the creator program an asset (more surface, more volume, more fees)
instead of a junk-market liability. Creators bring their own seed liquidity
and earn the 10% cut on volume.

## Points / rewards

The treasury funds a points program tracking early traders and LPs (volume,
depth, duration). Points are a ledger of contribution — no promise of any
token — and exist so early users are identifiable if the protocol ever
rewards them.

## Roadmap economics

**Perps** (long/short city indexes, funding-rate balanced, House-Pool-backed)
launch only once prediction markets have produced index history, users, and
pool depth. Perps deepen the same pool rather than fragmenting liquidity into
a second system.
