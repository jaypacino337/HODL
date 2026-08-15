# PumpBrokers

1,000 pixel brokers on Solana. Mint one for 1,000,000 $PUMPBROKER, sell it back for
950,000. The 50,000 spread per round trip stays in the treasury. That is the whole
mechanism.

Built as **three separate, independently deployable, independently killable pieces** —
not one program. That structure is not a preference; it is the fix for a previous
build where mint price and NFT creation were hard-coupled in a single program, which
made free mints impossible by construction and turned deployment into an ~8 SOL
surprise on launch day.

---

## The three pieces

| | What | When | Deployed as |
|---|---|---|---|
| **1** | Honorary mint — 10 free NFTs to named wallets | before the token exists | **a script, no program at all** |
| **2** | Public mint — 990 mintable, priced in $PUMPBROKER | deployed early, **opened at launch** | `programs/pumpbroker-mint` |
| **3** | Buyback — send a broker in, get 950,000 back | after launch, whenever you choose | `programs/pumpbroker-buyback` |

**Piece 1 needs no program.** Create a collection, create 10 assets, transfer them.
"Free" is not "a paid mint priced at zero" — it is the absence of a price concept
entirely. It is currently unbuilt by request.

**Piece 2's launch is one transaction.** Everything — deploy, config, pool seeding,
treasury creation — happens days earlier and is verified on devnet first. Launch day is
`set_active(true)`: ~5 seconds, 0.000005 SOL. Rollback is the same instruction and the
same 5 seconds.

**Piece 3 never requires touching Piece 2.** The mint program ships with two inert,
authority-gated hooks (`return_to_pool`, `payout`) that stay dead until
`set_redeemer` is called. Connecting or killing the buyback is one instruction on a
program that is already live, with no redeploy.

---

## Design decisions worth knowing

**Mint on demand — nothing is pre-minted.** The Core asset is created inside the
buyer's transaction with the buyer as `payer`, so they pay its ~0.0025 SOL rent and the
project's per-mint cost is zero. Pre-minting 1,000 assets would be roughly 3 SOL out of
pocket for nothing.

**Asset addresses are PDAs of the mint number.** Broker #418 always lives at a
computable address, so the whole collection reads in ten batched RPC calls with no
indexer, and double-minting a number is structurally impossible rather than a check
someone has to remember to write.

**Delayed reveal, on by default.** Any on-chain randomness we can reach can be
*simulated before it is sent*. With 100 airdrop-bearing pieces, a bot would simulate a
mint, check whether it drew a `GMEx`, and drop the transaction if not — free re-rolls
until it took the valuable pieces. The art index is drawn and recorded on chain at mint
time, but the URI stays a placeholder until the collection is fully drawn. The reveal
can only publish the index that was drawn; it cannot rewrite it.

**Lost races get a real error.** Two wallets reaching for the last broker is a normal
event, not an exception. The loser gets `MintRaced` — "someone else took that broker a
moment before you" — and the client retries with the next number, instead of the
runtime's opaque "account already in use".

**Integer base units everywhere.** No float touches an amount, in Rust or TypeScript.
Display formatting is BigInt string arithmetic.

---

## Layout

```
config/index.ts                    every address, price and supply number. One file.
programs/pumpbroker-mint/          PIECE 2
programs/pumpbroker-buyback/       PIECE 3
packages/pumpbrokers-site/         Next.js + TS + Tailwind
scripts/                           operational scripts (cost-gated)
tests/unit/                        runnable now, no chain needed
tests/anchor/                      full lifecycle, needs a validator
docs/LAUNCH_RUNBOOK.md             the ordered launch procedure + cost table
```

## Commands

```bash
npm install
npm run test           # unit tests + cargo check
npm run dev            # site at localhost:3000
npm run verify         # read-only pre-launch checklist
npm run launch         # set_active(true)   — the entire launch
npm run rollback       # set_active(false)  — same cost, same 5 seconds
```

## Build status

| | |
|---|---|
| Both Anchor programs | ✅ compile clean (`cargo check`) |
| 33 unit tests | ✅ passing — config maths, error tables, account layouts, discriminators, instruction encoding |
| All 11 operational scripts | ✅ written; each refuses safely when inputs are missing |
| `price-upload.ts` | ✅ verified against real 1024×1024 PNGs |
| Site | ✅ builds and serves; all 7 routes return 200 |
| RPC proxy allowlist | ✅ verified rejecting non-allowlisted methods |
| `anchor build` / `anchor test` | ❌ **never run** — no Solana toolchain in the build container |
| Devnet / mainnet | ❌ nothing deployed anywhere |

The programs are compile-verified, not behaviour-verified. `release.anza.xyz` is
blocked by this environment's egress proxy, so `cargo-build-sbf` and
`solana-test-validator` are unavailable and `tests/anchor/lifecycle.ts` has never
executed. Running it is the first step of
[the runbook](docs/LAUNCH_RUNBOOK.md#phase-0--devnet-rehearsal-do-this-first-in-full).

## What's left

Two things, and only one of them is mine:

1. **Run `anchor build && anchor test`.** Nothing here has touched a validator. This is
   the whole gap between "compiles" and "works", and it has to happen on a machine with
   the Solana toolchain.
2. **Devnet rehearsal**, then the pre-launch phases in the runbook. All cost-gated, all
   scripted.

After that, launch is `npm run launch`.

## Still needed from you

1. **True pixel resolution of the art** — if the 1024×1024 PNGs are upscales of
   e.g. 64×64 sources, storing the originals is visually identical (everything renders
   `image-rendering: pixelated`) and cuts permanent storage from ~4.0 SOL to ~0.1.
2. **`$PUMPBROKER` mint address and decimals** — everything assumes 6. If it is 9,
   change one constant in `config/index.ts`.
3. **Which 10 art indices** went out as honoraries.
4. **Royalty enforcement level** for the collection.

## Security

- No private key in the frontend or in any server route. Admin actions are signed by
  the owner's connected wallet; the admin page's gate is UI convenience, and the real
  check is `address = config.authority` in the program.
- The Helius key has no `NEXT_PUBLIC_` prefix and is never inlined into the client
  bundle. The browser reaches Helius through `/api/rpc`, which forwards only an
  allowlist of read methods — without it we would be an open relay and someone else's
  bot would burn the free-tier quota on launch day.
- The treasury is a program-owned PDA, never a personal wallet.
- Every transaction is simulated before the user is asked to sign, and errors resolve
  to the program's own message text with raw logs one click away.
