# @overbid/contracts

Solidity reference implementation of the OVERBID protocol, written for
**Robinhood Chain** (an Arbitrum Orbit L2 — standard EVM, standard tooling).
Until its public RPC ships, everything deploys unchanged to **Arbitrum
Sepolia**; collateral is **USDG** (Global Dollar), the stablecoin in the
Robinhood orbit, with any test ERC-20 standing in on testnet.

## Contracts

| Contract | Role |
|---|---|
| `OverbidMarket.sol` | One market: n-outcome fixed-product AMM (Gnosis FPMM math), USDG-collateralized complete sets, 2% trade fee, oracle resolution, 1:1 winner redemption |
| `HousePool.sol` | The LP vault. Deposit USDG → `ovLP` shares. Seeds markets, receives 70% of fees, settlement residuals, and the creator cut of protocol markets |
| `MarketFactory.sol` | Creates markets from **approved templates only**; protocol launches draw seed from the House Pool, community launches bring their own seed and earn the creator cut |
| `IndexOracle.sol` | Posts Parcl Labs index observations on-chain and resolves markets against them. v1: allow-listed poster, fully auditable; decentralized posting + dispute window is the roadmap |

## Fee flow

```
2% of every trade
├── 70% → HousePool          (LPs — the capital taking market risk)
├── 10% → market creator     (House Pool itself for protocol markets)
└── 20% → protocol treasury  (new market seeds, oracle costs, rewards)
```

## Market lifecycle (post-settlement ops)

After the oracle resolves a market, three permissionless calls close its
books — the oracle worker can fire them, or anyone can:

1. `market.distributeFees()` — 70% pool / 10% creator / 20% treasury
2. `market.sweepResidualToPool()` — leftover AMM inventory → USDG → pool
3. `factory.reconcileSettled(market)` — stop counting the seed as deployed
   capital (skipping this double-counts pool assets and blocks the last LP
   withdrawal — the E2E test covers it)

## Build & deploy

With [Foundry](https://book.getfoundry.sh):

```bash
forge build
# one command: collateral (MockUSDG w/ faucet), core stack, templates,
# and the five $SEED_USD-seeded launch markets
SEED_USD=50 forge script script/Deploy.s.sol:Deploy \
  --rpc-url arbitrum_sepolia --private-key $KEY --broadcast
```

## Test (no Foundry needed)

`e2e/` runs the full lifecycle — deploy → LP deposits → seed → buy/sell with
slippage guards → lock → resolve → 1:1 redeem → fee split → residual sweep →
reconcile → all LPs exit — on an in-process EVM and checks money conservation
to the cent:

```bash
cd e2e && npm install && npm test
```

> **Status:** compiles clean (solc 0.8.24, zero warnings) and the full
> lifecycle is exercised end-to-end by `e2e/`, but the code is *not audited*.
> Do not point real funds at it without an audit; see `docs/DISCLAIMER.md`.
