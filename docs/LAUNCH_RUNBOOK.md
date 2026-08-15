# PumpBrokers — launch runbook

The point of this document: **on launch day you run one command.** Everything else in
this file happens days earlier, on devnet first, then on mainnet with the mint still
paused.

If on launch day anyone proposes a deploy, an upload, a config migration or a "quick
fix", the answer is no. Pause instead (step L2), fix it, rehearse it, reopen.

---

## What is actually built right now

Being precise about this, because a runbook that lists commands which do not exist is
worse than no runbook.

| Script | Status |
|---|---|
| `scripts/set-active.ts` | ✅ built — the launch switch itself |
| `scripts/verify-deployment.ts` | ✅ built — the pre-launch checklist |
| `scripts/lib.ts` | ✅ built — cost gate + balance guard |
| `scripts/price-upload.ts` | ❌ not built |
| `scripts/upload-assets.ts` | ❌ not built — needs the art, see open question 1 |
| `scripts/create-collection.ts` | ❌ not built |
| `scripts/setup-mint.ts` | ❌ not built — needs the token mint + honorary indices |
| `scripts/setup-buyback.ts` | ❌ not built |
| `scripts/reveal.ts` | ❌ not built |
| `scripts/devnet-lifecycle.ts` | ❌ not built |

The two launch-critical scripts are done because those are the ones that run under
time pressure. The rest are blocked on inputs that have not arrived yet (the art, the
token mint address, the honorary indices) — writing them against guessed values would
mean rewriting them.

**Also unverified:** the programs are compile-checked (`cargo check`) but have never
run against a validator. The container they were written in has no Solana toolchain —
`release.anza.xyz` is blocked by the egress proxy — so `anchor build` and
`anchor test` have not been executed. **Phase 0 below is not optional.**

---

## Cost gate

Nothing on this page gets run until the table below has been read and approved, and
the wallet balance has been checked **immediately before** the step — not at the start
of the session.

| # | Step | SOL | Wallet | Recoverable | Time |
|---|---|---|---|---|---|
| P1 | Upload 990 images + 1,000 JSON | **0.1 – 4.0** ⚠️ | deployer | ❌ permanent | 10–40 min |
| P2 | Create mpl-core collection | ~0.003 | deployer | ✅ if burned | 5 s |
| P3 | Deploy `pumpbroker-mint` (`--max-len` tight) | **~2.1** | deployer | ✅ `program close` | 2–5 min |
| P4 | `initialize` (config + vault + treasury) | ~0.005 | authority | ✅ on close | 10 s |
| P5 | `init_pool` (990 indices) | ~0.03 | authority | ✅ on close | 5 s |
| P6 | Verify (read-only) | 0 | — | — | 2 min |
| **L1** | **`set_active(true)` — LAUNCH** | **0.000005** | authority | — | **~5 s** |
| L2 | `set_active(false)` — rollback | 0.000005 | authority | — | ~5 s |
| B1 | Deploy `pumpbroker-buyback` | ~1.3 | deployer | ✅ `program close` | 2 min |
| B2 | `initialize` + `set_redeemer` + `set_active` | ~0.01 | authority | ✅ | 30 s |
| R1 | Reveal 1,000 URIs after mint-out | ~0.005 | authority | ❌ (fees) | ~10 min |

**Totals.** Piece 2 pre-launch: **~2.3–6.2 SOL**, of which **~2.1 comes back** on
`solana program close`. Piece 3: **~1.3 SOL**, all recoverable. Program rent is a
deposit, not a spend — budget it as locked capital.

⚠️ **P1 is the only genuinely unpriced number.** It depends on the true pixel
resolution of the art (see [Open questions](#open-questions)). Run
`npx tsx scripts/price-upload.ts` first — it prints the exact cost before spending
anything.

> **Where the previous launch's missing ~8 SOL came from.** `solana program deploy`
> allocates **2× the binary size** by default for upgrade headroom. One monolithic
> program containing mint + pricing + redemption lands around 500–600 KB, doubled to
> ~1.2 MB, which is ~8 SOL of rent. Three small programs deployed with `--max-len` set
> tight cost ~3.4 SOL between them. **Splitting the architecture is the cost fix, not
> just a cleanliness fix.** Always pass `--max-len`.

---

## Before anything: check the balance

Run this before **every** on-chain step, not once per session.

```bash
solana balance -k ~/.config/solana/deployer.json
```

**Never begin a step you cannot finish with the SOL currently in the wallet.** If the
balance is below the step's cost plus 20%, stop and say so.

---

## Phase 0 — devnet rehearsal (do this first, in full)

```bash
# 1. Compile-check both programs (no toolchain surprises later)
cargo check --workspace

# 2. Unit tests — config maths, error tables, account layouts, discriminators
npm run test:unit

# 3. Full lifecycle against a local validator with mpl-core cloned in
anchor test

# 4. The same lifecycle end to end on devnet
npx tsx scripts/devnet-lifecycle.ts
```

Step 4 runs every phase below against devnet with real transactions and prints a
signature for each. **Do not proceed to mainnet until it is green end to end**, and do
not skip step 3 because step 4 passed — the local validator is where failure paths are
cheap to iterate on.

---

## Phase 1 — pre-launch (days before, mint stays paused)

### P1. Upload art and metadata

```bash
npx tsx scripts/price-upload.ts       # prints exact cost. Read it. Approve it.
npx tsx scripts/upload-assets.ts      # only after approval
```

Writes `METADATA_BASE_URI` and `PLACEHOLDER_URI` into `.env`. The base URI **must** end
in `/` — the program builds `${base}${artIndex}.json`.

### P2. Create the collection

```bash
npx tsx scripts/create-collection.ts
```

Sets the collection's update authority to the mint program's config PDA, which is what
lets the program create assets into the collection and publish the reveal later.
Writes `COLLECTION_ADDRESS` into `.env`.

### P3. Deploy the mint program

```bash
solana-keygen new -o keypairs/mint-program.json      # never committed
anchor build

# Put the real program id in the source and rebuild, or the deployed program
# will reject its own PDAs.
solana address -k keypairs/mint-program.json
#   -> paste into declare_id! in programs/pumpbroker-mint/src/lib.rs
#   -> and into Anchor.toml and config/index.ts
anchor build

# --max-len tight. Without it you pay double.
solana program deploy target/deploy/pumpbroker_mint.so \
  --program-id keypairs/mint-program.json \
  --max-len $(stat -c %s target/deploy/pumpbroker_mint.so)
```

> `--max-len` set to the exact binary size means **no room to grow on upgrade**. That is
> the right trade here — an upgrade that needs more space can be redeployed to a fresh
> address before launch, and after launch we do not want casual upgrades anyway. If you
> want headroom, budget ~2× the SOL.

### P4–P5. Configure and seed

```bash
npx tsx scripts/setup-mint.ts     # initialize + init_pool, in that order
```

Requires `HONORARY_INDICES` in `config/index.ts`. `init_pool` rejects a list whose
length does not match `HONORARY_COUNT`, so a wrong guess cannot ship silently.

### P6. Verify — read-only, no cost, do not skip

```bash
npx tsx scripts/verify-deployment.ts
```

Asserts all of:

- [ ] `config.is_active == false` ← **the most important line in this document**
- [ ] `config.price` == 1,000,000 × 10^decimals
- [ ] `config.total_supply == 1000`, `honorary_count == 10`
- [ ] `pool.indices.len() == 990`, and no honorary index is in it
- [ ] `config.treasury` is owned by the config PDA, **not** a personal wallet
- [ ] `config.authority` is the wallet you actually hold
- [ ] `config.redeemer` is unset — Piece 3 is not connected
- [ ] the collection's update authority is the config PDA
- [ ] `METADATA_BASE_URI` ends in `/` and `${base}0.json` resolves over HTTP

---

## Phase 2 — LAUNCH DAY

### L1. Open the mint

Two ways, same instruction. Use whichever you rehearsed.

```bash
npx tsx scripts/set-active.ts --active true
```

or: connect the authority wallet at `/admin` and press **OPEN THE MINT**.

**Cost: 0.000005 SOL. Time: ~5 seconds. That is the entire launch.**

### L2. Rollback

```bash
npx tsx scripts/set-active.ts --active false
```

Same instruction, same 5 seconds, same cost. Minting stops immediately; everything
already minted is untouched and stays in its owners' wallets. **Rolling back is cheap
and reversible — use it early rather than debugging a live mint.**

### Launch-day escalation rule

If anything fails twice, or you have spent 10 minutes on one problem: **pause the mint
and say so in one short message** — what you tried, what is blocking, what you need. Do
not keep grinding. A blocked agent that speaks up in two minutes is worth ten times one
that solves it in forty.

---

## Phase 3 — after launch

### B1–B2. Turn on the buyback

Only when you choose. This never touches Piece 2's deployment.

```bash
solana-keygen new -o keypairs/buyback-program.json
anchor build && solana program deploy target/deploy/pumpbroker_buyback.so \
  --program-id keypairs/buyback-program.json \
  --max-len $(stat -c %s target/deploy/pumpbroker_buyback.so)

npx tsx scripts/setup-buyback.ts   # initialize + set_redeemer + set_active
```

Both switches must be on: the buyback program active, **and** the mint program pointing
at it. Either one off means no redemptions.

**Kill switch:** `setRedeemerIx(authority, null)` — or **DISCONNECT** on `/admin`.
Redemption dies instantly. The mint keeps running. No redeploy.

### R1. Reveal

After the collection is fully drawn:

```bash
npx tsx scripts/reveal.ts
```

Publishes each asset's real URI. The program will only accept the art index that was
drawn on chain at mint time — the reveal cannot rewrite history, it can only publish it.

---

## Open questions

These block exact numbers above and are still unanswered:

1. **True pixel resolution of the art.** If the 1024×1024 PNGs are nearest-neighbour
   upscales of e.g. 64×64 sources, storing the originals and rendering with
   `image-rendering: pixelated` is visually identical and cuts P1 from ~4.0 SOL to
   ~0.1. This is the single largest unpriced number in the project.
2. **`$PUMPBROKER` mint address and decimals.** Everything assumes 6. If it is 9,
   change `PUMPBROKER_DECIMALS` in `config/index.ts` — one constant, nothing else.
3. **`HONORARY_INDICES`** — which 10 of the 1,000 went out as honoraries.
4. **Royalty enforcement** on the collection (`None` / `Delegated` / `Compatible`).
   Affects marketplace behaviour; set at P2 and awkward to change afterwards.
