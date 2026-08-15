/**
 * Phase 0, step 4 — the full lifecycle end to end on devnet, with real transactions.
 *
 *   node scripts/devnet-lifecycle.ts --keypair ~/.config/solana/devnet.json
 *
 * Creates its own throwaway $PUMPBROKER stand-in at the same 6 decimals, runs the
 * whole sequence, and prints a signature for each step. Refuses to run against
 * mainnet — this script deliberately has no mainnet code path.
 *
 * What it proves, in order:
 *   1. a fresh deploy cannot mint (paused by default)
 *   2. a non-authority cannot open the mint
 *   3. one instruction opens it
 *   4. minting charges the buyer and credits the PROGRAM treasury
 *   5. a stale mint number gets MintRaced, not a runtime error
 *   6. redemption is dead until BOTH switches are on
 *   7. redeem pays out, the asset lands in the vault, supply is unchanged
 *   8. the spread stays in the treasury
 *   9. disconnecting the buyback does not stop the mint
 *  10. pausing is instant and reversible
 *
 * This is the rehearsal the runbook refers to. Do not go to mainnet until it is green.
 */
import { CLUSTER } from "../config/index.ts";
import { die } from "./lib.ts";

async function main() {
  if (CLUSTER === "mainnet-beta") {
    die(
      "This script is devnet-only and has no mainnet path.\n" +
        "    Set NEXT_PUBLIC_CLUSTER=devnet and use a devnet keypair.",
    );
  }

  console.log(`
  DEVNET LIFECYCLE REHEARSAL

  This script needs the compiled programs deployed to devnet first. That
  requires the Solana toolchain, which is NOT available in the container this
  repo was built in (release.anza.xyz is blocked by the egress proxy), so this
  sequence has never been executed anywhere.

  Run these on your own machine, in order:

    1. cargo check --workspace                # compile check (already green)
    2. npm run test:unit                      # 26 tests (already green)
    3. anchor build                           # NEVER RUN — start here
    4. anchor test                            # NEVER RUN — the real verification
    5. deploy to devnet, then re-run this script

  Step 4 is the one that matters. Everything in tests/anchor/lifecycle.ts is an
  assertion about behaviour that has only ever been type-checked. If something in
  this design is wrong, that is where it surfaces — cheaply, on a local validator,
  instead of on mainnet with a token live.

  Once steps 3 and 4 are green and the programs are on devnet, this script will
  drive the full sequence. Until then there is nothing for it to talk to, and
  pretending otherwise would be the exact failure mode this project exists to
  avoid.
`);

  process.exit(1);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
