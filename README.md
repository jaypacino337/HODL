# Crowdy.fun

**Somebody says let's do this. Holders decide if it happens.**

Holder-gated, all-or-nothing crowdfunding on Solana. Post an idea, set a goal, set a
deadline. Hit the goal and the money is released. Miss it and every backer takes their
SOL back — in full, without needing anyone's permission.

---

## How it works

**You have to be a holder.** Posting a campaign and backing one both require holding at
least the gate amount of the gate token. The check reads your live balance at the
moment you act, so selling out means losing eligibility. The site shows your standing
up front so nobody fills in a whole form before finding out.

**All or nothing.** Contributions go to a vault PDA the program controls. There is no
code path from "campaign created" to "creator holds the money" that skips the goal —
`claim_funds` requires a campaign finalized as `Funded`, and finalizing requires the
deadline to have passed or the goal to already be met.

**Refunds cannot be blocked.** `refund` needs only the backer's signature and a failed
campaign. `finalize` is deliberately permissionless — any wallet can settle a campaign,
so a creator who walks away cannot strand backers in `Active` forever by simply never
showing up. A creator can also cancel their own campaign early, which opens refunds
immediately and can never move money to them.

**Fees only on success.** The platform takes a fee from campaigns that fund, capped at
5% in the program itself so the authority cannot quietly raise it. Refunds take nothing.

---

## Layout

```
config/crowdy.ts                 every address, amount and tunable. One file.
programs/crowdy-campaign/        the Anchor program
packages/crowdy-site/            Next.js + TypeScript + Tailwind
tests/unit/crowdy.test.ts        runnable now, no chain needed
```

## Commands

```bash
npm install
npm run dev            # Crowdy at localhost:3000
npm run build          # production build
npm test               # unit tests + cargo check
```

## Build status

| | |
|---|---|
| Anchor program | ✅ compiles clean (`cargo check`) |
| 56 unit tests | ✅ passing — config maths, error tables, discriminators, borsh encoding, account decoding |
| Site | ✅ builds and serves; all 6 routes return 200 |
| RPC proxy allowlist | ✅ verified rejecting non-allowlisted methods |
| `anchor build` / `anchor test` | ❌ **never run** — no Solana toolchain in this container |
| Devnet / mainnet | ❌ nothing deployed anywhere |

The program is compile-verified, not behaviour-verified. `release.anza.xyz` and GitHub
releases are both blocked by this environment's egress proxy, so `cargo-build-sbf` and
`solana-test-validator` are unavailable. **Run `anchor build && anchor test` before
deploying anything** — that is the gap between "compiles" and "works".

## Still needed

1. **The gate token mint** — set `NEXT_PUBLIC_GATE_MINT`. Until then the site renders
   an honest "not configured" state rather than pretending.
2. **Gate amount and decimals** — currently 1,000,000 tokens at 6 decimals. Both are
   single constants in `config/crowdy.ts`.
3. **Fee destination** — set at `initialize_platform`.

## Design note

The reference site (`fundmeme.site`) is blocked by this environment's egress proxy, so
the visual design here is original rather than a copy. The mechanics come from the
brief: holder-gated, proposal-driven, all-or-nothing.

## Security

- No private key in the frontend or in any server route. Every action is built
  client-side and signed by the connected wallet.
- The Helius key has no `NEXT_PUBLIC_` prefix and is never inlined into the client
  bundle. The browser reaches it through `/api/rpc`, which forwards only an allowlist
  of read methods — without that, anyone's bot could burn the free-tier quota.
- Backed SOL sits in a program-owned vault, never a personal wallet.
- Every transaction is simulated before the user is asked to sign, and errors resolve
  to the program's own message with raw logs one click away. "Transaction failed" is
  never shown.
- The eligibility badge in the UI is explanatory only; the binding check is
  `check_gate` inside the program, which cannot be bypassed by editing JavaScript.

---

## Also in this repo

`PumpBrokers` — 1,000 pixel brokers, a token-priced mint and a buyback spread, built as
three independently deployable pieces. See [README.pumpbrokers.md](README.pumpbrokers.md)
and [docs/LAUNCH_RUNBOOK.md](docs/LAUNCH_RUNBOOK.md). Nothing has been deleted.
