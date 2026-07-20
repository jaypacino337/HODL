# Deployment guide

This walks through a **devnet** dry run end-to-end. Do not point any of this
at mainnet-beta, and do not fund any wallet with real money, until you've run
a full cycle on devnet and read `docs/DISCLAIMER.md`.

## 0. Prerequisites

- Node.js >= 18.18
- The [Solana CLI](https://docs.solanalabs.com/cli/install) (for `solana airdrop` on devnet)
- `npm install` at the repo root (npm workspaces will link the `@sherwood/*` packages)

## 1. Generate wallets

You need four keypairs. The Solana CLI's `solana-keygen new` works, or reuse
`token-launch`'s `loadOrCreateKeypair` helper which generates one on first
run:

```bash
mkdir -p keys
solana-keygen new --outfile keys/payer.json
solana-keygen new --outfile keys/mint-authority.json
solana-keygen new --outfile keys/fee-authority.json
solana-keygen new --outfile keys/lp-vault.json
solana-keygen new --outfile keys/rewards-vault.json
solana airdrop 2 $(solana-keygen pubkey keys/payer.json) --url devnet
```

## 2. Choose your launch path

**Path A — pump.fun (recommended, matches the live mechanism described on
the website):** launch the coin through pump.fun's own UI/API using the
`fee-authority` wallet as the creator (creator-fee vaults are keyed by
creator pubkey, so whichever wallet creates the coin is the one that must
run the harvester). Then set `MINT_ADDRESS` in `.env` to the resulting mint.

**Path B — self-launch with Token-2022 transfer fees:**

```bash
cp .env.example .env
npm run create-mint --workspace packages/token-launch
```

This prints a `MINT_ADDRESS` to paste into `.env`, and mints the full
1,000,000,000 supply to the payer's associated token account. You'd then
need to pair it into a Raydium pool yourself before `autolp` has anything to
deposit into.

## 3. Configure `.env`

```bash
cp .env.example .env
# fill in MINT_ADDRESS, the four *_KEYPAIR_PATH vars, and EXCLUDED_OWNERS
# (at minimum: the fee-authority, LP vault, and rewards vault addresses,
# so the protocol doesn't airdrop itself)
```

## 4. Build the workspace

```bash
npm install
npm run build
```

## 5. Run one harvest cycle manually

```bash
npm run harvest --workspace packages/fee-harvester
```

This claims whatever pump.fun creator fees have accrued (zero on a fresh
devnet coin — you'll need real trading volume against the bonding curve to
see nonzero fees) and splits the fee-authority wallet's balance into the LP
and rewards vaults.

## 6. Start the bot (scheduler + API)

```bash
npm run start:bot
```

This runs one full cycle immediately, then every `SNAPSHOT_INTERVAL_MS`
(default 15 minutes: `*/15 * * * *`), and serves `GET /api/stats` on
`API_PORT` (default 4000).

## 7. Run the website

```bash
cp packages/website/.env.example packages/website/.env.local
# point NEXT_PUBLIC_BOT_API_URL at the bot's API and NEXT_PUBLIC_MINT_ADDRESS
# at your mint
npm run dev:website
```

## Going to mainnet

1. Re-run steps 1–3 with fresh, securely stored keypairs (a hardware wallet
   or at minimum an encrypted secrets manager — not plaintext JSON files in
   a repo or CI env var, ever).
2. Set `RPC_URL` to a paid mainnet RPC provider (public endpoints rate-limit
   `getProgramAccounts`, which the snapshot bot calls every cycle).
3. Set `RAYDIUM_POOL_ID` once the coin graduates from pump.fun's bonding
   curve, so `autolp` has a pool to deposit into.
4. Read `docs/DISCLAIMER.md` and get your own legal advice before
   publicly marketing a token with promised holder rewards — securities-law
   exposure is real and jurisdiction-dependent.
