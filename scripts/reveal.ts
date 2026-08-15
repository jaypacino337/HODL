/**
 * R1 — the reveal.
 *
 *   node scripts/reveal.ts --keypair ~/.config/solana/authority.json
 *   node scripts/reveal.ts --dry-run          # show what would be published
 *
 * Publishes each minted broker's real metadata URI. Reads the art index that was drawn
 * ON CHAIN at mint time out of the pool account — the program will reject any other
 * value, so this script cannot rewrite who got what even if it wanted to. It can only
 * publish what already happened.
 *
 * Resumable: a receipt file records each revealed mint number, so a dropped run picks
 * up where it left off rather than re-sending 900 transactions.
 *
 * Batched 8 instructions per transaction — about 125 transactions for a full
 * collection, roughly 0.005 SOL and ten minutes.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PublicKey, Transaction } from "@solana/web3.js";
import { COLLECTION_ADDRESS, METADATA_BASE_URI } from "../config/index.ts";
import { connection, costGate, die, explorer, flag, keypairArg, loadKeypair, requireBalance } from "./lib.ts";
import { revealIx } from "../packages/pumpbrokers-site/lib/ix.ts";
import { decodeError } from "../packages/pumpbrokers-site/lib/errors.ts";
import { decodeMintConfig } from "../packages/pumpbrokers-site/lib/chain.ts";
import { configPda, poolPda } from "../packages/pumpbrokers-site/lib/pda.ts";

const RECEIPTS = "reveal-receipts.json";
const PER_TX = 8;

async function main() {
  if (!COLLECTION_ADDRESS) die("COLLECTION_ADDRESS unset.");
  if (!METADATA_BASE_URI) die("METADATA_BASE_URI unset.");

  const conn = connection();
  const cfgAi = await conn.getAccountInfo(configPda());
  if (!cfgAi) die("Mint program not deployed.");
  const cfg = decodeMintConfig(cfgAi.data);

  if (!cfg.delayedReveal) {
    die("This collection was configured with instant reveal. There is nothing to publish.");
  }

  const poolAi = await conn.getAccountInfo(poolPda());
  if (!poolAi) die("No pool account.");

  // Pool layout: 8 disc, 1 bump, then indices Vec<u16>, then assigned Vec<u16>.
  // `assigned[mintNumber]` is the art index drawn on chain at mint time.
  const indicesLen = poolAi.data.readUInt32LE(9);
  const assignedAt = 9 + 4 + indicesLen * 2;
  const assignedLen = poolAi.data.readUInt32LE(assignedAt);
  const assigned: number[] = [];
  for (let i = 0; i < assignedLen; i++) {
    assigned.push(poolAi.data.readUInt16LE(assignedAt + 4 + i * 2));
  }

  if (assignedLen !== cfg.minted) {
    die(`Pool records ${assignedLen} assignments but config says ${cfg.minted} minted. Refusing to guess.`);
  }

  const receipts: Record<string, string> = existsSync(RECEIPTS)
    ? JSON.parse(readFileSync(RECEIPTS, "utf8"))
    : {};
  const todo = assigned
    .map((artIndex, mintNumber) => ({ mintNumber, artIndex }))
    .filter((x) => !receipts[String(x.mintNumber)]);

  console.log(`\n  minted:    ${cfg.minted}`);
  console.log(`  revealed:  ${cfg.minted - todo.length}`);
  console.log(`  remaining: ${todo.length}\n`);

  if (flag("dry-run")) {
    for (const t of todo.slice(0, 20)) {
      console.log(`   mint #${t.mintNumber + 1} -> art ${t.artIndex} -> ${METADATA_BASE_URI}${t.artIndex}.json`);
    }
    if (todo.length > 20) console.log(`   ... and ${todo.length - 20} more`);
    console.log("\n  Dry run. Nothing sent.\n");
    return;
  }
  if (todo.length === 0) {
    console.log("  Everything already revealed.\n");
    return;
  }

  const txCount = Math.ceil(todo.length / PER_TX);
  await costGate([
    {
      step: `reveal ${todo.length} assets (${txCount} transactions)`,
      sol: txCount * 0.000005,
      wallet: "authority",
      recoverable: false,
      seconds: txCount * 3,
    },
  ]);

  const authority = loadKeypair(keypairArg());
  await requireBalance(authority.publicKey, txCount * 0.000005 + 0.01);
  const collection = new PublicKey(COLLECTION_ADDRESS);

  for (let i = 0; i < todo.length; i += PER_TX) {
    const batch = todo.slice(i, i + PER_TX);
    const tx = new Transaction();
    for (const b of batch) {
      tx.add(
        revealIx({
          authority: authority.publicKey,
          collection,
          mintNumber: b.mintNumber,
          artIndex: b.artIndex,
        }),
      );
    }

    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority.publicKey;
    tx.sign(authority);

    const sim = await conn.simulateTransaction(tx);
    if (sim.value.err) {
      const d = decodeError(
        Object.assign(new Error(JSON.stringify(sim.value.err)), { logs: sim.value.logs ?? [] }),
        "mint",
      );
      die(`Batch at #${batch[0].mintNumber} failed simulation — nothing sent for this batch.\n    ${d.message}`);
    }

    const sig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

    for (const b of batch) receipts[String(b.mintNumber)] = sig;
    writeFileSync(RECEIPTS, JSON.stringify(receipts, null, 2));
    console.log(`  ✓ #${batch[0].mintNumber + 1}–#${batch[batch.length - 1].mintNumber + 1}  ${explorer(sig)}`);
  }

  console.log(`\n  ✓ Reveal complete. Receipts in ${RECEIPTS}\n`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
