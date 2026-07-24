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

## Build

Uses [Foundry](https://book.getfoundry.sh) (no npm dependencies):

```bash
forge build
forge test
forge create src/HousePool.sol:HousePool --rpc-url arbitrum_sepolia --constructor-args <USDG>
```

Deploy order: `HousePool` → `IndexOracle` → `MarketFactory(USDG, pool, oracle, treasury)`
→ `pool.setFactory(factory)` → approve templates → `createProtocolMarket(...)` × 5.

> **Status:** compile-clean reference code, *not audited*. Do not point real
> funds at it without an audit; see `docs/DISCLAIMER.md`.
