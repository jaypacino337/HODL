/**
 * PIECE 1 — the honorary mint.
 *
 *   node scripts/honorary-mint.ts --recipients honorary.json --keypair ~/.config/solana/authority.json
 *
 * This has NOTHING to do with the token, the mint price, or any program. It is:
 * create 10 assets, transfer them. There is no Candy Machine, no price config, no
 * paid-mint code path, and the $PUMPBROKER token does not need to exist yet.
 *
 * "Free" here is not "a paid mint priced at zero" — there is no price concept involved
 * at all. You already own these assets; you are handing them out.
 *
 * `honorary.json` is a list of { "wallet": "<base58>", "artIndex": <0..999> }.
 * Whatever indices you use here MUST also go in HONORARY_INDICES in config/index.ts,
 * because the public mint's pool is seeded as 0..1000 minus exactly that list.
 *
 * Idempotent: assets already minted are skipped, so a partial run can be re-run
 * safely. Writes a receipt to honorary-receipts.json with all 10 signatures.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  HONORARY_COUNT,
  METADATA_BASE_URI,
  TOTAL_SUPPLY,
  COLLECTION_ADDRESS,
} from "../config/index.ts";
import { arg, costGate, die, keypairArg, requireBalance, umi } from "./lib.ts";

type Recipient = { wallet: string; artIndex: number };
const RECEIPTS = "honorary-receipts.json";

async function main() {
  const listPath = arg("recipients") ?? "honorary.json";
  if (!existsSync(listPath)) {
    die(
      `No ${listPath}. Create it as a list of:\n` +
        `      [{ "wallet": "<base58>", "artIndex": 0 }, ...]\n` +
        `    ${HONORARY_COUNT} entries, one per honorary.`,
    );
  }
  if (!COLLECTION_ADDRESS) die("COLLECTION_ADDRESS unset. Run create-collection first.");
  if (!METADATA_BASE_URI) die("METADATA_BASE_URI unset. Run upload-assets first.");

  const recipients = JSON.parse(readFileSync(listPath, "utf8")) as Recipient[];

  // Validate everything BEFORE sending anything. A half-finished airdrop of
  // one-of-a-kind assets is not a state anyone wants to reconcile by hand.
  if (recipients.length !== HONORARY_COUNT) {
    die(`${listPath} has ${recipients.length} entries, expected ${HONORARY_COUNT}.`);
  }
  const seenIdx = new Set<number>();
  for (const [i, r] of recipients.entries()) {
    if (!Number.isInteger(r.artIndex) || r.artIndex < 0 || r.artIndex >= TOTAL_SUPPLY) {
      die(`entry ${i}: artIndex ${r.artIndex} is outside 0..${TOTAL_SUPPLY - 1}.`);
    }
    if (seenIdx.has(r.artIndex)) die(`entry ${i}: artIndex ${r.artIndex} is duplicated.`);
    seenIdx.add(r.artIndex);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(r.wallet)) {
      die(`entry ${i}: "${r.wallet}" is not a base58 address.`);
    }
  }

  const receipts: Record<string, string> = existsSync(RECEIPTS)
    ? JSON.parse(readFileSync(RECEIPTS, "utf8"))
    : {};
  const todo = recipients.filter((r) => !receipts[String(r.artIndex)]);

  console.log(`\n  PIECE 1 — HONORARY MINT (no program, no token, no price)\n`);
  for (const r of recipients) {
    const done = receipts[String(r.artIndex)];
    console.log(`   #${String(r.artIndex).padStart(4)}  ->  ${r.wallet}  ${done ? "(already sent)" : ""}`);
  }
  if (todo.length === 0) {
    console.log(`\n  All ${HONORARY_COUNT} already minted. Nothing to do.\n`);
    return;
  }

  await costGate([
    {
      step: `create ${todo.length} Core assets`,
      sol: 0.0035 * todo.length,
      wallet: "authority",
      recoverable: true,
      seconds: 3 * todo.length,
    },
    {
      step: `transfer ${todo.length} assets (no new accounts)`,
      sol: 0.000005 * todo.length,
      wallet: "authority",
      recoverable: false,
      seconds: 3 * todo.length,
    },
  ]);

  const u = await umi(keypairArg());
  const { PublicKey } = await import("@solana/web3.js");
  await requireBalance(new PublicKey(String(u.identity.publicKey)), 0.0035 * todo.length + 0.01);

  const { create, generateSigner, publicKey } = await import("./umi-imports.ts");

  for (const r of todo) {
    const asset = generateSigner(u);
    // Create directly to the recipient — no separate transfer step, one fewer
    // transaction and one fewer way for an asset to get stranded mid-run.
    const res = await create(u, {
      asset,
      collection: { publicKey: publicKey(COLLECTION_ADDRESS) } as never,
      name: `PumpBroker #${r.artIndex}`,
      uri: `${METADATA_BASE_URI}${r.artIndex}.json`,
      owner: publicKey(r.wallet),
    }).sendAndConfirm(u);

    const sig = Buffer.from(res.signature).toString("base64");
    receipts[String(r.artIndex)] = sig;
    // Write after EVERY mint, not at the end — a crash halfway must not lose the
    // record of what already went out.
    writeFileSync(RECEIPTS, JSON.stringify(receipts, null, 2));
    console.log(`  ✓ #${r.artIndex} -> ${r.wallet}`);
    console.log(`    asset ${asset.publicKey}`);
    console.log(`    sig   ${sig}`);
  }

  console.log(`\n  Done. ${Object.keys(receipts).length}/${HONORARY_COUNT} minted.`);
  console.log(`  Receipts in ${RECEIPTS}\n`);
  console.log(`  Now put these indices in HONORARY_INDICES in config/index.ts:`);
  console.log(`    [${recipients.map((r) => r.artIndex).sort((a, b) => a - b).join(", ")}]\n`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
