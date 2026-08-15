/**
 * B2 — turn on the buyback. AFTER launch, whenever you choose.
 *
 *   node scripts/setup-buyback.ts --keypair ~/.config/solana/authority.json
 *
 * Three instructions:
 *   1. buyback initialize   — create its config, PAUSED
 *   2. mint set_redeemer    — point the mint program at it
 *   3. buyback set_active   — open redemption
 *
 * None of this redeploys or upgrades the mint program. Step 2 is a normal instruction
 * on a program that is already live, which is the entire reason the two hooks exist.
 *
 * Kill switch, any time:  node scripts/setup-buyback.ts --disconnect
 * That reverses step 2 only. Redemption dies instantly; the mint keeps running.
 */
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  BUYBACK_PAYOUT,
  CLUSTER,
  MINT_PRICE,
  ROUND_TRIP_SPREAD,
  formatTokens,
} from "../config/index.ts";
import { connection, costGate, die, explorer, flag, keypairArg, loadKeypair, requireBalance } from "./lib.ts";
import {
  buybackInitializeIx,
  buybackSetActiveIx,
  setRedeemerIx,
} from "../packages/pumpbrokers-site/lib/ix.ts";
import { decodeError } from "../packages/pumpbrokers-site/lib/errors.ts";
import { decodeMintConfig } from "../packages/pumpbrokers-site/lib/chain.ts";
import { buybackConfigPda, configPda } from "../packages/pumpbrokers-site/lib/pda.ts";

async function main() {
  const authority = loadKeypair(keypairArg());
  const conn = connection();

  const cfgAi = await conn.getAccountInfo(configPda());
  if (!cfgAi) die("The mint program is not deployed. Nothing to connect a buyback to.");
  const cfg = decodeMintConfig(cfgAi.data);

  if (cfg.authority !== authority.publicKey.toBase58()) {
    die(`This keypair is not the mint authority.\n    on chain: ${cfg.authority}`);
  }

  // ---- kill switch ----
  if (flag("disconnect")) {
    console.log(`\n  DISCONNECTING the buyback from the mint program.`);
    console.log(`  The mint keeps running. Nothing is redeployed.\n`);
    await costGate([
      { step: "set_redeemer(None) — kill redemption", sol: 0.000005, wallet: "authority", recoverable: false, seconds: 5 },
    ]);
    await send("set_redeemer(None)", setRedeemerIx(authority.publicKey, null));
    console.log(`\n  ✓ Redemption is off. The mint is still ${cfg.isActive ? "OPEN" : "paused"}.\n`);
    return;
  }

  console.log(`\n  cluster:  ${CLUSTER}`);
  console.log(`  mint price:   ${formatTokens(MINT_PRICE)} $PUMPBROKER`);
  console.log(`  buyback pays: ${formatTokens(BUYBACK_PAYOUT)} $PUMPBROKER`);
  console.log(`  spread kept:  ${formatTokens(ROUND_TRIP_SPREAD)} per round trip`);
  console.log(`  buyback PDA:  ${buybackConfigPda().toBase58()}\n`);

  if (BUYBACK_PAYOUT >= MINT_PRICE) {
    die("BUYBACK_PAYOUT must be below MINT_PRICE or the treasury drains on every round trip.");
  }

  const exists = await conn.getAccountInfo(buybackConfigPda());

  await costGate([
    ...(exists
      ? []
      : [{ step: "buyback initialize", sol: 0.005, wallet: "authority", recoverable: true, seconds: 10 }]),
    { step: "mint set_redeemer(buyback)", sol: 0.000005, wallet: "authority", recoverable: false, seconds: 5 },
    { step: "buyback set_active(true)", sol: 0.000005, wallet: "authority", recoverable: false, seconds: 5 },
  ]);
  await requireBalance(authority.publicKey, 0.02);

  if (!exists) {
    await send("buyback initialize", buybackInitializeIx(authority.publicKey, BUYBACK_PAYOUT), "buyback");
  } else {
    console.log("  buyback config already exists — skipping initialize");
  }

  await send("set_redeemer", setRedeemerIx(authority.publicKey, buybackConfigPda()));
  await send("buyback set_active(true)", buybackSetActiveIx(authority.publicKey, true), "buyback");

  console.log(`\n  ✓ Sell-back is live.`);
  console.log(`    Both switches are on: the buyback is active AND the mint points at it.`);
  console.log(`    Either one off means no redemptions.\n`);
  console.log(`  Kill it any time:  node scripts/setup-buyback.ts --disconnect\n`);

  async function send(
    label: string,
    ix: ReturnType<typeof setRedeemerIx>,
    which: "mint" | "buyback" = "mint",
  ) {
    const tx = new Transaction().add(ix);
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority.publicKey;
    tx.sign(authority);

    const sim = await conn.simulateTransaction(tx);
    if (sim.value.err) {
      const d = decodeError(
        Object.assign(new Error(JSON.stringify(sim.value.err)), { logs: sim.value.logs ?? [] }),
        which,
      );
      die(`${label} simulation failed — nothing sent.\n    ${d.message}\n\n${(sim.value.logs ?? []).join("\n")}`);
    }

    const sig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    console.log(`  ✓ ${label}  ${explorer(sig)}`);
  }
}

void PublicKey;
main().catch((e) => die(e instanceof Error ? e.message : String(e)));
