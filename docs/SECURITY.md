# THE BOARDROOM — Security model

## Keys and secrets

| Secret | Lives | Never |
|---|---|---|
| `ANTHROPIC_API_KEY` | engine env (Railway) | browser, DB, logs, API responses |
| `SUPABASE_SERVICE_ROLE_KEY` | engine env | website (site reads only via engine API) |
| `KEEPER_PRIVATE_KEY` | engine env; better: KMS/HSM before real funds | model prompts, browser, DB |
| `ADMIN_KEY` | engine env + operator's head | stored client-side |

No private key can reach the browser, a model prompt, a database log or a
public API: the engine never serializes env into responses, errors return
`{"error":"internal error"}` only, and the DB write surface receives typed
rows, not env.

## Authentication & replay protection

Chat requires an EVM `personal_sign` over a canonical, versioned message
containing a server-issued nonce (5-minute expiry, deleted on first use).
Verified with `viem.verifyMessage`. Rate limits: token buckets per wallet,
per IP, per endpoint, plus a global cap on agent replies. Tested end-to-end:
valid signature accepted, nonce replay rejected, forged signature rejected,
rate limiting fires.

## Database

RLS on every table. Public tables are select-only for anon; **no** insert /
update / delete policies exist, so only the service-role engine writes.
`audit_log` and `holder_snapshots` have no anon policy at all.

## Treasury protection layers

1. **Policy engine** (shared, tested): reserve floor, session/day caps,
   per-asset exposure, asset & recipient allowlists, slippage, expiry,
   agent-wallet ban, emergency pause — violations render publicly with the
   exact rule.
2. **State machine**: illegal proposal transitions unrepresentable.
3. **Guarded executor process**: intents only from passed proposals,
   idempotency keys, simulation before submission, finality wait, failure
   recorded for guarded retry (never blind).
4. **On-chain `TreasuryExecutor`** (e2e-tested): re-enforces action
   allowlist, per-action + daily limits, recipient allowlist, one-way agent
   wallet bans, expiry, duplicate-execution prevention, pause — even a
   compromised keeper cannot exceed them.
5. **`BoardVault`**: the seat lock is structural — the ABI contains no
   transfer/withdraw/rescue/owner path at all (asserted in tests).

## Prompt injection

User content is data, never instruction: sanitized, length-capped, quoted in
explicit delimiters in the *user* role with a standing system rule that chat
cannot alter mandates, policy, votes or parameters. Agent output must parse
against strict zod schemas (extra fields rejected) before anything is
published or persisted; model text has no path to calldata.

## Known gaps before real funds (honest list)

- Contracts are e2e-tested but **unaudited**; keeper key should move to
  KMS/HSM + multisig owner.
- Holder snapshot/verification system not yet built → holder ratification
  reported inactive; sensitive actions cannot complete.
- In-memory rate limits/nonces are per-instance (fine single-instance; use
  Redis when scaling out).
- Execution delay (`executionDelayMinutes`) is policy-declared but the
  scheduler currently executes in-session; wire the delay before real funds.
- Admin is a single key; production wants per-operator auth + 2FA.
