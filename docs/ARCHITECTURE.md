# Architecture

```
                         ┌─────────────────────┐
                         │      pump.fun        │
                         │  bonding curve / AMM  │
                         └──────────┬────────────┘
                                    │ trading fees accrue to
                                    │ per-creator vault PDA
                                    ▼
┌───────────────┐   claim    ┌───────────────────┐   split    ┌────────────┐
│ fee-authority   │──────────▶│  fee-harvester     │──────────▶│  LP vault   │
│ wallet          │           │  (packages/         │           │            │
└───────────────┘           │   fee-harvester)    │           └─────┬──────┘
                              └──────────┬──────────┘                 │
                                         │                            │ deposit
                                         │                            ▼
                                         │                    ┌────────────────┐
                                         │                    │  autolp          │
                                         │                    │  (Raydium CPMM)  │
                                         │                    └────────────────┘
                                         ▼
                              ┌────────────────────┐
                              │   rewards vault      │
                              └──────────┬───────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────┐
                          │        snapshot-bot            │
                          │  every 15 min:                 │
                          │   1. fetch all $ARROW holders   │
                          │   2. compute pro-rata payouts   │
                          │   3. batch-send SOL transfers   │
                          │   4. persist to SQLite          │
                          │   5. expose /api/stats          │
                          └──────────────┬─────────────────┘
                                         │
                                         ▼
                              ┌────────────────────┐
                              │      website          │
                              │  (packages/website)   │
                              │  reads /api/stats      │
                              └────────────────────┘
```

## Packages

| Package | Responsibility |
|---|---|
| `packages/shared` | Env-driven config loader, shared TypeScript types, RPC connection helper. |
| `packages/token-launch` | Optional: creates a Token-2022 mint with the `TransferFee` extension, for a self-launch (non-pump.fun) path. |
| `packages/fee-harvester` | Claims pump.fun creator-fee rewards (bonding curve + post-graduation AMM) and/or Token-2022 withheld transfer fees; splits proceeds between the LP vault and rewards vault. |
| `packages/autolp` | Deposits the LP vault's SOL into the ARROW/SOL Raydium pool once one exists. |
| `packages/snapshot-bot` | The orchestrator: runs the full cycle on a cron (default every 15 minutes), persists snapshots/distributions to SQLite, and serves a small stats API. |
| `packages/website` | Next.js marketing site + live dashboard, reads from the snapshot-bot's API. |

## Why pump.fun fees aren't a per-transfer tax

Classic "reflection" meme coins (SafeMoon-style) work by taxing every transfer
at the SPL Token level. pump.fun doesn't support that: coins launched there
are plain SPL mints with no transfer hook, because pump.fun controls
distribution entirely through its own bonding-curve program. What pump.fun
*does* give the token's creator is a cut of trading fees, claimable via a
permissionless `collectCreatorFee` instruction (see
`packages/fee-harvester/src/harvestPumpFunCreatorFees.ts`, verified against
[pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs)).
Sherwood's harvester automates that claim and treats it as the fee source
that funds LP growth and holder rewards.

If you'd rather have a true automatic per-transfer tax instead of relying on
pump.fun's creator-fee program, use the `packages/token-launch` path to mint
a Token-2022 token with the `TransferFee` extension and pair it on Raydium
directly, skipping pump.fun entirely. `fee-harvester` supports harvesting
both sources.
