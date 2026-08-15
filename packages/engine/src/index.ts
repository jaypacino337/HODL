import { loadConfig, makeConnection } from "@attn/shared";
import { AttnDb } from "./db";
import { buildApi } from "./api";
import {
  ensureOpenEpoch,
  runAdExpiry,
  runBuybackCycle,
  runClaimCycle,
  runEpochCycle,
  runScanCycle,
} from "./engine";

/**
 * ATTENTION MARKETS engine — the single Railway service that:
 *   - claims pump.fun creator fees every 15 minutes and splits them
 *     50% buybacks / 50% attention rewards,
 *   - executes buybacks on schedule,
 *   - runs the attention scanner every hour,
 *   - closes weekly epochs and pays attention contributors,
 *   - serves the terminal API (points, ads, scanner, leaderboard).
 */
async function main() {
  const config = loadConfig();
  const connection = makeConnection(config.rpcUrl);
  const db = new AttnDb(config.supabaseUrl, config.supabaseServiceRoleKey);

  console.log(
    `[engine] ${config.ticker} · mint ${config.mint.toBase58()} · treasury ${config.treasuryKeypair.publicKey.toBase58()}`
  );
  console.log(
    `[engine] splits: fees ${config.feeBuybackShare * 100}% buyback / ${100 - config.feeBuybackShare * 100}% rewards · ` +
      `revenue ${config.revenueBuybackShare * 100}% buyback / ${100 - config.revenueBuybackShare * 100}% dev`
  );

  await ensureOpenEpoch(config, db);

  const app = buildApi(config, connection, db);
  app.listen(config.apiPort, () => console.log(`[engine] API listening on :${config.apiPort}`));

  // Kick off a first scan immediately so the terminal is never empty.
  runScanCycle(config, db).catch(() => {});

  const every = (ms: number, fn: () => Promise<void>, label: string) => {
    setInterval(() => fn().catch((err) => console.error(`[${label}] threw:`, err)), ms);
  };

  every(config.claimIntervalMs, () => runClaimCycle(config, connection, db), "claim");
  every(config.scanIntervalMs, () => runScanCycle(config, db), "scan");
  every(config.buybackIntervalMs, () => runBuybackCycle(config, connection, db), "buyback");
  every(2 * 60 * 1000, async () => {
    await runEpochCycle(config, connection, db);
    await runAdExpiry(db);
  }, "epoch");

  // First claim shortly after boot instead of waiting a full interval.
  setTimeout(() => runClaimCycle(config, connection, db).catch(() => {}), 15_000);
}

main().catch((err) => {
  console.error("[engine] fatal:", err);
  process.exit(1);
});
