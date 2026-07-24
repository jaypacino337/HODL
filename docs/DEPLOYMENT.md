# OVERBID — Deployment

Three services + contracts. Ship them in this order; each step works without
the ones after it.

## 1 · Website → Vercel (works with zero config)

1. Import the GitHub repo into Vercel.
2. That's it. The root `vercel.json` builds `packages/website`; demo mode
   needs **no environment variables**. (Equivalent manual setup: set Root
   Directory to `packages/website`, framework Next.js.)
3. Later, add `NEXT_PUBLIC_API_URL=<oracle worker URL>` to switch data reads
   from built-in definitions to the live API.

## 2 · Supabase (ledger)

1. Create a project, open the SQL editor, run
   `supabase/migrations/0001_init.sql`.
2. Note the project URL and the **service_role** key (Settings → API).
   The service key is server-side only — it never goes in the website.

## 3 · Oracle worker → Railway

1. New Railway service from this repo; it picks up
   `packages/oracle-worker/railway.json` (start:
   `npm run start --workspace packages/oracle-worker`).
2. Set variables:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   PARCL_LABS_API_KEY=...        # https://docs.parcllabs.com/
   ORACLE_POLL_MINUTES=360
   CORS_ORIGINS=https://<your-vercel-domain>
   ```
3. The worker mirrors market definitions into Postgres, pulls index series on
   each tick, and settles any market whose window has elapsed. Without keys it
   still boots and serves `/markets` — useful for API development.

## 4 · Contracts → Arbitrum Sepolia now, Robinhood Chain when public

Prereq: [Foundry](https://book.getfoundry.sh). From `packages/contracts`:

```bash
forge build

# 1. collateral: USDG address (testnet: any 18-decimal test ERC-20)
# 2. deploy
forge create src/HousePool.sol:HousePool        --constructor-args $USDG   ...
forge create src/IndexOracle.sol:IndexOracle    ...
forge create src/MarketFactory.sol:MarketFactory \
  --constructor-args $USDG $HOUSE_POOL $ORACLE $TREASURY ...

# 3. wire up
cast send $HOUSE_POOL "setFactory(address)" $FACTORY
cast send $ORACLE     "setPoster(address,bool)" $WORKER_KEY_ADDR true

# 4. approve templates, then create the five launch markets
cast send $FACTORY "setTemplate(bytes32,bool,string,string)" \
  $(cast keccak "city-race:max-gain") true "city-race:max-gain" "Parcl Labs metro price feed (US only)"
cast send $FACTORY "createProtocolMarket(bytes32,string,string,uint8,uint64,uint256)" ...
```

Robinhood Chain is an Arbitrum Orbit L2 — when its public RPC opens, add it
to `foundry.toml` and redeploy unchanged, with real USDG as collateral.

**Do not deploy real funds without an audit and legal review** — see
`DISCLAIMER.md`.

## 5 · Go-live checklist

- [ ] Vercel site up, demo trading works
- [ ] Supabase migration applied; RLS verified (anon can read, not write)
- [ ] Worker polling: `index_observations` filling per feed
- [ ] A test market settled end-to-end on testnet (seed → trade → resolve →
      redeem → residual sweep → fee distribution)
- [ ] Oracle poster key stored as a secret, never in the repo
- [ ] Legal review for prediction-market operation in target jurisdictions
