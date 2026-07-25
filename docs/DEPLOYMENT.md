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

Prereq: [Foundry](https://book.getfoundry.sh) and a testnet key with a little
Arbitrum Sepolia ETH ([faucets](https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info)).
One command deploys everything — collateral (MockUSDG with a public faucet),
HousePool, IndexOracle, MarketFactory, approved templates, and the five
launch markets:

```bash
cd packages/contracts
forge build

SEED_USD=50 POOL_FLOAT_USD=500 \
forge script script/Deploy.s.sol:Deploy \
  --rpc-url arbitrum_sepolia --private-key $KEY --broadcast
```

- `SEED_USD` — per-market seed. $50 works; expect a ~5-point price move per
  $5 trade on a 50/50 market. $250–500 keeps impact civil (see
  `docs/ECONOMICS.md`).
- `USDG=0x...` — use an existing collateral token instead of MockUSDG.
- After deploy: `cast send $ORACLE "setPoster(address,bool)" $WORKER_ADDR true`
  and put the addresses in `.env` for the oracle worker.

Anyone can test-trade: `cast send $USDG "faucet()"` mints 10,000 mock USDG
per day.

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
