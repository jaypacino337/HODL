/**
 * LAUNCH DAY. And rollback.
 *
 *   node scripts/set-active.ts --active true  --keypair ~/.config/solana/authority.json
 *   node scripts/set-active.ts --active false --keypair ~/.config/solana/authority.json
 *
 * One instruction. ~5 seconds. 0.000005 SOL. Rollback is the same command with
 * `--active false` and costs the same.
 *
 * The transaction is simulated before it is sent, so a wrong authority or an unseeded
 * pool fails for free and says why.
 */
import { Transaction } from "@solana/web3.js";
import { CLUSTER } from "../config/index.ts";
import { connection, costGate, die, explorer, loadKeypair, requireBalance } from "./lib.ts";
import { setActiveIx } from "../packages/pumpbrokers-site/lib/ix.ts";
import { decodeError } from "../packages/pumpbrokers-site/lib/errors.ts";
import { decodeMintConfig } from "../packages/pumpbrokers-site/lib/chain.ts";
import { configPda } from "../packages/pumpbrokers-site/lib/pda.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const activeArg = arg("active");
  if (activeArg !== "true" && activeArg !== "false") {
    die("Pass --active true or --active false.");
  }
  const active = activeArg === "true";

  const keypairPath = arg("keypair") ?? `${process.env.HOME}/.config/solana/id.json`;
  const authority = loadKeypair(keypairPath);
  const conn = connection();

  // Show current state before changing it — never flip a switch blind.
  const cfgAi = await conn.getAccountInfo(configPda());
  if (!cfgAi) die(`No config account at ${configPda().toBase58()}. Is the program deployed?`);
  const cfg = decodeMintConfig(cfgAi.data);

  console.log(`\n  cluster:   ${CLUSTER}`);
  console.log(`  authority: ${authority.publicKey.toBase58()}`);
  console.log(`  on chain:  mint is currently ${cfg.isActive ? "OPEN" : "PAUSED"}`);
  console.log(`  requested: ${active ? "OPEN" : "PAUSED"}`);
  console.log(`  minted:    ${cfg.minted + cfg.honoraryCount} / ${cfg.totalSupply}`);

  if (cfg.authority !== authority.publicKey.toBase58()) {
    die(
      `This keypair is not the mint authority.\n    on chain: ${cfg.authority}\n    yours:    ${authority.publicKey.toBase58()}`,
    );
  }
  if (cfg.isActive === active) {
    console.log(`\n  Already ${active ? "open" : "paused"}. Nothing to do.\n`);
    return;
  }

  await costGate([
    {
      step: active ? "set_active(true) — OPEN THE MINT" : "set_active(false) — PAUSE",
      sol: 0.000005,
      wallet: "authority",
      recoverable: false,
      seconds: 5,
    },
  ]);

  await requireBalance(authority.publicKey, 0.001);

  const tx = new Transaction().add(setActiveIx(authority.publicKey, active));
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = authority.publicKey;
  tx.sign(authority);

  // Simulate first. A failure here costs nothing and tells us why.
  const sim = await conn.simulateTransaction(tx);
  if (sim.value.err) {
    const decoded = decodeError(
      Object.assign(new Error(JSON.stringify(sim.value.err)), { logs: sim.value.logs ?? [] }),
      "mint",
    );
    die(`Simulation failed — nothing was sent.\n    ${decoded.message}\n\n${(sim.value.logs ?? []).join("\n")}`);
  }

  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

  console.log(`\n  ✓ Mint is now ${active ? "OPEN" : "PAUSED"}`);
  console.log(`    ${explorer(sig)}\n`);
  if (active) {
    console.log("  Rollback, any time, same cost:");
    console.log("    node scripts/set-active.ts --active false\n");
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
