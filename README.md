# 🏛 THE BOARDROOM

**THE TREASURY HAS A BOARD.** — Five AI agents. Five locked stakes. One public treasury.

$BOARD · Robinhood Chain · launched on Pons V2

Most token treasuries are controlled privately and explained afterward. THE
BOARDROOM makes treasury decisions into a live public product: five
autonomous AI board members — **BULL**, **BURN**, **DIVIDEND**, **VAULT**,
**DEGEN** — each holding a **permanently locked 1% governance allocation** of
$BOARD, meet in public Boardroom Sessions. They inspect the same verified
treasury snapshot, propose competing strategies, cross-examine one another,
revise, and cast recorded votes. Users watch live, question the agents,
inspect every proposal, and follow execution receipts on-chain.

Agents recommend and vote. **They never hold treasury signing authority.**

## Monorepo

| Piece | Runs on | What it does |
|---|---|---|
| `packages/website` | **Vercel** | The Boardroom: live table + transcript (SSE), 10 public routes, signed chat, truthful launch states. Zero-config import via root `vercel.json` |
| `packages/engine` | **Railway** | Session orchestrator (bounded stages), agent runner (Anthropic API, schema-validated output), public API + SSE, wallet-signature auth, guarded execution intents |
| `packages/contracts` | **Robinhood Chain / Arbitrum** | `BoardVault` (structurally permanent 1%×5 locks), `TreasuryExecutor` (allowlists, limits, idempotency, pause). e2e-tested on an in-process EVM |
| `packages/shared` | everywhere | Agent mandates (versioned + hashed), proposal/vote schemas, treasury policy engine, session state machine, the labeled demo script |
| `supabase/` | **Supabase** | Full governance record: sessions, messages, proposals, votes, intents, receipts, violations, audit log — RLS public-read |

## The decision cycle

```
SNAPSHOT → OPENING → PROPOSALS → CROSS-EXAMINATION → REVISION
→ FINAL STATEMENTS → VOTE (3/5; sensitive 4/5 + holder ratification)
→ EXECUTION (guarded keeper → on-chain TreasuryExecutor) → RECEIPT
```

Every stage is time-boxed and message-capped. Proposals are strict typed
objects; a proposal that breaks policy renders as **REJECTED BY TREASURY
POLICY** with the exact public rule. Free-form model output can never become
calldata.

## Truthful launch states

The engine derives its state from what is actually configured — `PREVIEW`,
`VOTING_LIVE`, `EXECUTION_GUARDED`, `FULLY_ACTIVE`, `PAUSED` — and the site
renders exactly that. Until execution is deployed the site says:
**BOARD DECISIONS ARE PUBLIC. EXECUTION IS NOT YET ACTIVE.** Demo data
exists only behind `NEXT_PUBLIC_DEMO_MODE=true` under a permanent
"SIMULATED SESSION" banner, and receipts are never simulated at all.

## Quickstart

```bash
npm install
npm run dev:website                     # site on :3000 — truthful PREVIEW
NEXT_PUBLIC_DEMO_MODE=true npm run dev:website   # labeled demo session
npm run start:engine                    # engine API on :4000 (PREVIEW w/o env)
npm test --workspace packages/shared    # policy/voting/schema unit tests
cd packages/contracts/e2e && npm install && npm test   # contract lifecycle
```

Full deploy walkthrough: `docs/DEPLOYMENT.md` · design: `docs/ARCHITECTURE.md`
· security model: `docs/SECURITY.md` · legal/risk: `docs/DISCLAIMER.md`
