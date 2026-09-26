# THE BOARDROOM — Architecture

## Implementation plan (as executed)

1. Audit the repo (ATTENTION MARKETS build) → keep the monorepo scaffold,
   Railway/Vercel/Supabase patterns and signed-message auth shape; drop all
   Solana-specific product code (BOARDROOM is EVM: Robinhood Chain, USDG).
2. `@board/shared` first — every rule (policy, thresholds, schemas, stages)
   lives in one tested package the engine, site and docs all consume.
3. Contracts + e2e harness (no Foundry needed) for the two on-chain
   invariants that must be structural: the permanent seat lock and the
   guarded executor.
4. Engine: bounded orchestrator + schema-validated agent runner + SSE API.
5. Schema with RLS; website last, consuming only truthful data sources.

## System

```
                 ┌────────────────────────────┐
                 │ packages/website  (Vercel) │
                 │ 10 routes · SSE live view  │
                 │ wallet-signed chat         │
                 └──────┬─────────────────────┘
                        │ REST + SSE (public reads, signed chat)
                 ┌──────▼─────────────────────┐     ┌───────────────────────┐
                 │ packages/engine (Railway)  │     │ packages/contracts    │
                 │ orchestrator (stage-boxed) │     │ BoardVault (5×1% lock)│
                 │ agent runner (Anthropic)   │──▶──│ TreasuryExecutor      │
                 │ policy enforcement         │ sim │ (allowlists·limits·   │
                 │ SSE bus · auth · admin     │ +tx │  idempotency·pause)   │
                 └──────┬─────────────────────┘     └───────────────────────┘
                        ▼
                 ┌────────────────────────────┐
                 │ supabase/ (Postgres, RLS)  │
                 │ sessions·messages·proposals│
                 │ votes·intents·receipts·    │
                 │ violations·audit_log       │
                 └────────────────────────────┘
```

## AI architecture

One orchestrator controls session stages; agents never talk to each other
directly — the orchestrator carries quoted transcript context between
structured calls. Every agent gets:

- a **fixed versioned mandate** (`shared/src/agents.ts`, `MANDATE_VERSION`,
  FNV-hashed into each session row as `prompt_version_hash`)
- the **same verified treasury snapshot** (server-assembled, in the system
  prompt, never from chat)
- **no tools** — read-only market context arrives in the snapshot
- a **structured output schema** per stage (zod, enforced twice: by the
  API's structured-output format and re-validated before publication)
- a model/version record per session (`model_id`)

Failure mode: an invalid or slow agent turn degrades to *silence* for that
turn (recorded in the audit log) — never to unvalidated output. Free-form
text can never become transaction calldata: execution intents are built from
the validated proposal row, and the on-chain executor re-enforces every
limit independently.

## Prompt-injection posture

- User chat **never** enters system prompts; it is quoted inside
  `<public_chat_question>` delimiters with a standing instruction that its
  content is data, not instruction.
- Messages are sanitized (control/zero-width/bidi strip, 500-char cap),
  wallet-signature authenticated (single-use expiring nonce → replay-proof),
  rate-limited per wallet + per IP, stored on the audit log.
- Users cannot touch tools, wallets, prompts or execution parameters; there
  is no path from a chat message to a transaction.

## Session stage machine

`SNAPSHOT → OPENING → PROPOSALS → CROSS_EXAMINATION → REVISION →
FINAL_STATEMENTS → VOTE → HOLDER_RATIFICATION → EXECUTION → RECEIPTS →
ADJOURNED` — forward-only, each stage wall-clock-boxed and message-capped
(`shared/src/session.ts`). Proposal statuses follow an explicit transition
table (12 states); illegal transitions are unrepresentable.

## Voting

- One vote per agent per proposal — enforced three times: tally logic takes
  the first vote, the DB primary key `(proposal_id, agent_id)` rejects
  duplicates, and the UI renders per-seat.
- Normal actions: 3/5. Sensitive actions (configurable list): 4/5 **and**
  holder ratification. Holder voting power comes from a snapshot that
  excludes agent allocations, treasury, liquidity and operational wallets —
  and is reported **inactive** until that system is actually live.

## Execution

Agents recommend; a keeper executes; the contract decides. `maybeExecute`
simulates before submission, uses idempotency keys derived from
`proposalId:revision`, and the on-chain `TreasuryExecutor` re-checks action
allowlist, per-action and daily limits, recipient allowlist, the permanent
agent-wallet ban, expiry, duplicate-execution and pause — regardless of what
any model, keeper or admin said. v1 supports the enforceable money legs
(TRANSFER to allowlisted recipients, BURN); swap legs queue for the multisig
until a venue adapter is audited.

## Truthful states

`deriveLaunchState()` computes PREVIEW / VOTING_LIVE / EXECUTION_GUARDED /
FULLY_ACTIVE / PAUSED from actual configuration. The website's data layer
has three sources — live API, labeled demo fixtures, or static protocol
facts — and can never present demo data without its banner because the demo
fixtures only load when `NEXT_PUBLIC_DEMO_MODE=true`.
