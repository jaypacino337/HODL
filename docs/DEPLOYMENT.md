# THE BOARDROOM — Deployment

Order: Supabase → Railway → Vercel → contracts. Each step upgrades the
launch state the site truthfully reports.

## 1 · Supabase

1. New project → SQL editor → run `supabase/migrations/0001_init.sql`.
2. Copy Project URL → `SUPABASE_URL`, service_role key →
   `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never the website).

## 2 · Engine → Railway

1. New service from this repo (`packages/engine/railway.json` supplies the
   start command).
2. Variables (see `.env.example`):
   - `ANTHROPIC_API_KEY` — the board's model access (server-only)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_KEY` — long random string; guards session/pause/policy ops
   - `CORS_ORIGINS` — your Vercel domain
   - `CHAIN_RPC_URL`, `CHAIN_ID`, `TREASURY_ADDRESS`, `USDG_TOKEN_ADDRESS`,
     `BOARD_TOKEN_ADDRESS`, `STOCK_TOKENS_JSON`, `TOKEN_PRICES_JSON` —
     read-only treasury snapshots (no session runs without them: the board
     never argues from invented balances)
   - `SESSION_INTERVAL_MINUTES` — cadence of automatic sessions
3. `GET /health` → `{"ok":true,"launchState":"VOTING_LIVE"}` once model +
   DB are configured. Convene manually:
   `curl -X POST <api>/api/admin/session/start -H 'x-admin-key: …'`

## 3 · Website → Vercel

1. Import the repo; the root `vercel.json` builds `packages/website` with
   zero configuration. (Alternative: set Root Directory to
   `packages/website`.)
2. Optional env: `NEXT_PUBLIC_API_URL=<railway domain>` for live data +
   chat. Without it the site is a truthful PREVIEW.
3. Never set `NEXT_PUBLIC_DEMO_MODE=true` in production — it renders the
   labeled simulated session for local demonstration only.

## 4 · Contracts → Robinhood Chain (Arbitrum Sepolia until public RPC)

With [Foundry](https://book.getfoundry.sh), from `packages/contracts`
(`forge build` compiles; the e2e suite in `e2e/` runs without Foundry):

```bash
# BoardVault — seat names + delegate identities, then one-shot 1%×5 funding
forge create src/BoardVault.sol:BoardVault --rpc-url arbitrum_sepolia \
  --private-key $KEY --constructor-args $BOARD_TOKEN \
  '["BULL","BURN","DIVIDEND","VAULT","DEGEN"]' \
  '[$D_BULL,$D_BURN,$D_DIVIDEND,$D_VAULT,$D_DEGEN]'
cast send $BOARD_TOKEN "approve(address,uint256)" $VAULT $((5 * ONE_PCT))
cast send $VAULT "fundSeats(uint256)" $ONE_PCT

# TreasuryExecutor — keeper + limits + one-way agent bans
forge create src/TreasuryExecutor.sol:TreasuryExecutor --constructor-args $KEEPER ...
cast send $EXECUTOR "setTokenLimits(address,uint256,uint256)" $USDG 5000e6 8000e6
cast send $EXECUTOR "banAgentWallet(address)" $D_BULL   # × 5 delegates
```

Publish the verified addresses on `/token` only after they exist. Move the
executor's owner to the protocol multisig and the keeper key into KMS before
any real funds; see `docs/SECURITY.md` → Known gaps.

## Go-live checklist

- [ ] Migration applied; anon key can read, cannot write
- [ ] Engine `launchState` correct at every config tier (PREVIEW → VOTING_LIVE → EXECUTION_GUARDED)
- [ ] A full session ran end-to-end on testnet config and the record persisted
- [ ] Executor limits + agent bans set on-chain; simulation path exercised
- [ ] `packages/contracts/e2e` green; shared tests green; site builds
- [ ] Legal review (AI-governed treasury + token = regulated territory in
      many jurisdictions; see `docs/DISCLAIMER.md`)
