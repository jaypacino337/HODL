/**
 * P2 — create the mpl-core collection.
 *
 *   node scripts/create-collection.ts --keypair ~/.config/solana/authority.json
 *
 * The collection's update authority is set to the MINT PROGRAM'S CONFIG PDA, not to
 * your wallet. That is what lets the program create assets into the collection during
 * a public mint and publish the reveal afterwards. If you point it at a personal
 * wallet instead, every mint will fail with an authority error and the fix is a new
 * collection — so this script refuses to run any other way.
 *
 * Writes COLLECTION_ADDRESS to .env.
 */
import { COLLECTION_ADDRESS, TOTAL_SUPPLY } from "../config/index.ts";
import { configPda } from "../packages/pumpbrokers-site/lib/pda.ts";
import { costGate, die, flag, keypairArg, requireBalance, umi, writeEnv } from "./lib.ts";

async function main() {
  if (COLLECTION_ADDRESS && !flag("force")) {
    die(
      `COLLECTION_ADDRESS is already set (${COLLECTION_ADDRESS}).\n` +
        `    Creating a second collection would orphan the first. Pass --force if you really mean it.`,
    );
  }

  const name = "PumpBrokers";
  const uri = process.env.COLLECTION_METADATA_URI;
  if (!uri) {
    die(
      "COLLECTION_METADATA_URI is unset. Run scripts/upload-assets.ts first, or set it\n" +
        "    to the collection-level metadata JSON (name, description, image).",
    );
  }

  const u = await umi(keypairArg());
  const { createCollection, generateSigner } = await import("./umi-imports.ts");

  const authority = configPda().toBase58();
  console.log(`\n  collection name:  ${name}`);
  console.log(`  metadata:         ${uri}`);
  console.log(`  update authority: ${authority}  (mint program config PDA)`);
  console.log(`  supply cap:       ${TOTAL_SUPPLY}\n`);

  await costGate([
    {
      step: "create mpl-core collection",
      sol: 0.003,
      wallet: "authority",
      recoverable: true,
      seconds: 5,
    },
  ]);
  await requireBalance(loadPk(u), 0.01);

  const collection = generateSigner(u);
  const result = await createCollection(u, {
    collection,
    name,
    uri,
    // The program signs as this PDA when it creates assets into the collection.
    updateAuthority: authority as never,
  }).sendAndConfirm(u);

  const sig = Buffer.from(result.signature).toString("base64");
  console.log(`\n  ✓ collection created`);
  console.log(`    address: ${collection.publicKey}`);
  console.log(`    sig:     ${sig}\n`);

  writeEnv("NEXT_PUBLIC_COLLECTION_ADDRESS", String(collection.publicKey));
  console.log("  Next: node scripts/setup-mint.ts\n");
}

function loadPk(u: { identity: { publicKey: unknown } }) {
  const { PublicKey } = require("@solana/web3.js") as typeof import("@solana/web3.js");
  return new PublicKey(String(u.identity.publicKey));
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
