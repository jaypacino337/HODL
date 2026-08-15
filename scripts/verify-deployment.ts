/**
 * Read-only pre-launch verification. Costs nothing, takes two minutes, and is the last
 * thing standing between a misconfigured deploy and a live mainnet mint.
 *
 *   node scripts/verify-deployment.ts
 *
 * Exits non-zero if ANY check fails. Run it after setup, and again right before you
 * open the mint.
 */
import { PublicKey } from "@solana/web3.js";
import {
  CLUSTER,
  COLLECTION_ADDRESS,
  HONORARY_COUNT,
  METADATA_BASE_URI,
  MINT_PRICE,
  PUBLIC_SUPPLY,
  PUMPBROKER_MINT,
  TOTAL_SUPPLY,
  formatTokens,
} from "../config/index.ts";
import { connection, die } from "./lib.ts";
import {
  decodeMintConfig,
  decodeVaultQueue,
} from "../packages/pumpbrokers-site/lib/chain.ts";
import {
  configPda,
  poolPda,
  treasuryPda,
  vaultPda,
} from "../packages/pumpbrokers-site/lib/pda.ts";

let failures = 0;

function check(ok: boolean, label: string, detail = ""): void {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log(`\n  VERIFYING DEPLOYMENT — cluster: ${CLUSTER}\n`);

  if (!PUMPBROKER_MINT) die("PUMPBROKER_MINT is unset. Nothing to verify.");
  if (!COLLECTION_ADDRESS) die("COLLECTION_ADDRESS is unset. Run create-collection first.");

  const conn = connection();
  const cfgAi = await conn.getAccountInfo(configPda());
  if (!cfgAi) die(`No config account at ${configPda().toBase58()}. Is the program deployed?`);

  const cfg = decodeMintConfig(cfgAi.data);

  // The single most important line in this script.
  check(cfg.isActive === false, "MINT IS PAUSED", cfg.isActive ? "IT IS OPEN — STOP" : "");

  check(
    cfg.price === MINT_PRICE,
    "price matches config",
    `on chain ${formatTokens(cfg.price)}, expected ${formatTokens(MINT_PRICE)}`,
  );
  check(cfg.totalSupply === TOTAL_SUPPLY, "total supply is 1,000", `${cfg.totalSupply}`);
  check(cfg.honoraryCount === HONORARY_COUNT, "honorary count is 10", `${cfg.honoraryCount}`);
  check(cfg.paymentMint === PUMPBROKER_MINT, "payment mint matches $PUMPBROKER");
  check(cfg.collection === COLLECTION_ADDRESS, "collection matches config");

  // Piece 3 must be dark at launch.
  check(cfg.redeemer === null, "buyback is NOT connected", cfg.redeemer ?? "");

  // Treasury must be program-owned, never personal.
  check(
    cfg.treasury === treasuryPda().toBase58(),
    "treasury is the program PDA, not a personal wallet",
    cfg.treasury,
  );
  const treasuryAi = await conn.getAccountInfo(new PublicKey(cfg.treasury));
  check(Boolean(treasuryAi), "treasury account exists");

  // Pool seeded and honoraries excluded.
  const poolAi = await conn.getAccountInfo(poolPda());
  if (!poolAi) {
    check(false, "pool is seeded", "no pool account — run init_pool");
  } else {
    const remaining = poolAi.data.readUInt32LE(9);
    check(
      remaining === PUBLIC_SUPPLY - cfg.minted,
      `pool holds ${PUBLIC_SUPPLY - cfg.minted} unminted indices`,
      `${remaining}`,
    );
  }

  const vaultAi = await conn.getAccountInfo(vaultPda());
  check(Boolean(vaultAi), "vault account exists");
  if (vaultAi) {
    check(decodeVaultQueue(vaultAi.data).length === 0, "vault queue is empty");
  }

  // Metadata actually resolves. A base URI missing its trailing slash produces
  // "https://arweave.net/x417.json" and every asset points at nothing.
  check(Boolean(METADATA_BASE_URI?.endsWith("/")), "metadata base URI ends in '/'");
  if (METADATA_BASE_URI) {
    try {
      const r = await fetch(`${METADATA_BASE_URI}0.json`);
      check(r.ok, "metadata resolves over HTTP", `${METADATA_BASE_URI}0.json -> ${r.status}`);
    } catch (e) {
      check(false, "metadata resolves over HTTP", String(e));
    }
  }

  console.log(
    failures === 0
      ? "\n  ALL CHECKS PASSED. Safe to open the mint with scripts/set-active.ts.\n"
      : `\n  ${failures} CHECK(S) FAILED. DO NOT LAUNCH.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
