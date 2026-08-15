/**
 * P4 + P5 — configure the mint and seed the art pool.
 *
 *   node scripts/setup-mint.ts --keypair ~/.config/solana/authority.json
 *
 * Two instructions, in order, both cost-gated and both simulated first. The mint is
 * left PAUSED — this script has no way to open it, deliberately. Opening it is
 * scripts/set-active.ts and nothing else.
 *
 * Refuses to run until every required config value is set, because a mainnet mint
 * pointed at a placeholder URI is not something you can quietly fix afterwards.
 */
import { Transaction } from "@solana/web3.js";
import {
  CLUSTER,
  COLLECTION_ADDRESS,
  DELAYED_REVEAL,
  HONORARY_COUNT,
  HONORARY_INDICES,
  METADATA_BASE_URI,
  MINT_PRICE,
  PLACEHOLDER_URI,
  PUMPBROKER_MINT,
  TOTAL_SUPPLY,
  assertDeployReady,
  formatTokens,
} from "../config/index.ts";
import { connection, costGate, die, explorer, keypairArg, loadKeypair, requireBalance } from "./lib.ts";
import { initPoolIx, initializeIx } from "../packages/pumpbrokers-site/lib/ix.ts";
import { decodeError } from "../packages/pumpbrokers-site/lib/errors.ts";
import { configPda, poolPda, treasuryPda } from "../packages/pumpbrokers-site/lib/pda.ts";
import { PublicKey } from "@solana/web3.js";

async function main() {
  // One call, and it names every missing value rather than failing on the first.
  assertDeployReady();

  const authority = loadKeypair(keypairArg());
  const conn = connection();

  if (!METADATA_BASE_URI!.endsWith("/")) {
    die(
      `METADATA_BASE_URI must end in "/" — the program builds \${base}\${index}.json.\n` +
        `    Got: ${METADATA_BASE_URI}`,
    );
  }
  if (HONORARY_INDICES!.length !== HONORARY_COUNT) {
    die(`HONORARY_INDICES has ${HONORARY_INDICES!.length} entries, expected ${HONORARY_COUNT}.`);
  }

  console.log(`\n  cluster:     ${CLUSTER}`);
  console.log(`  authority:   ${authority.publicKey.toBase58()}`);
  console.log(`  token:       ${PUMPBROKER_MINT}`);
  console.log(`  collection:  ${COLLECTION_ADDRESS}`);
  console.log(`  price:       ${formatTokens(MINT_PRICE)} $PUMPBROKER (${MINT_PRICE} base units)`);
  console.log(`  supply:      ${TOTAL_SUPPLY} total, ${HONORARY_COUNT} honorary, ${TOTAL_SUPPLY - HONORARY_COUNT} mintable`);
  console.log(`  reveal:      ${DELAYED_REVEAL ? "DELAYED (recommended)" : "instant"}`);
  console.log(`  treasury:    ${treasuryPda().toBase58()}  (program PDA)\n`);

  const already = await conn.getAccountInfo(configPda());
  if (already) die(`Config already exists at ${configPda().toBase58()}. Nothing to do.`);

  await costGate([
    { step: "initialize (config + vault + treasury)", sol: 0.005, wallet: "authority", recoverable: true, seconds: 10 },
    { step: `init_pool (${TOTAL_SUPPLY - HONORARY_COUNT} indices)`, sol: 0.03, wallet: "authority", recoverable: true, seconds: 5 },
  ]);
  await requireBalance(authority.publicKey, 0.05);

  await sendOne(
    "initialize",
    initializeIx({
      authority: authority.publicKey,
      paymentMint: new PublicKey(PUMPBROKER_MINT!),
      collection: new PublicKey(COLLECTION_ADDRESS!),
      price: MINT_PRICE,
      totalSupply: TOTAL_SUPPLY,
      honoraryCount: HONORARY_COUNT,
      delayedReveal: DELAYED_REVEAL,
      baseUri: METADATA_BASE_URI!,
      placeholderUri: PLACEHOLDER_URI!,
    }),
  );

  await sendOne("init_pool", initPoolIx(authority.publicKey, HONORARY_INDICES!));

  console.log(`\n  ✓ Mint configured and PAUSED.`);
  console.log(`    config: ${configPda().toBase58()}`);
  console.log(`    pool:   ${poolPda().toBase58()}\n`);
  console.log(`  Next, and do not skip it:  node scripts/verify-deployment.ts\n`);

  async function sendOne(label: string, ix: ReturnType<typeof initPoolIx>) {
    const tx = new Transaction().add(ix);
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
      die(`${label} simulation failed — nothing sent.\n    ${d.message}\n\n${(sim.value.logs ?? []).join("\n")}`);
    }

    const sig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    console.log(`  ✓ ${label}  ${explorer(sig)}`);
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
