import cron from "node-cron";
import { loadConfig, makeConnection } from "@sherwood/shared";
import { runHarvestCycle } from "@sherwood/fee-harvester";
import { runAutoLpCycle } from "@sherwood/autolp";
import { fetchHolders } from "./holders";
import { computePayouts, sendPayouts } from "./distribute";
import { SherwoodDb } from "./db";

const VAULT_RESERVE_LAMPORTS = 0.01 * 1e9;

/**
 * One full tick of the protocol: claim pump.fun creator fees, top up the
 * liquidity pool, snapshot every holder, and airdrop the rewards vault's
 * balance out pro-rata. Runs on a cron every `SNAPSHOT_INTERVAL_MS`
 * (15 minutes by default).
 */
export async function runFullCycle(db: SherwoodDb) {
  const config = loadConfig();
  const connection = makeConnection(config.rpcUrl);
  const startedAt = new Date().toISOString();
  console.log(`[scheduler] cycle starting @ ${startedAt}`);

  const harvest = await runHarvestCycle().catch((err) => {
    console.error("[scheduler] harvest step failed (continuing with existing vault balance):", err.message);
    return null;
  });
  if (harvest) {
    for (const r of harvest.pumpResults) {
      db.insertHarvest(r.source, r.lamportsHarvested, r.signature);
    }
  }

  await runAutoLpCycle().catch((err) =>
    console.error("[scheduler] auto-LP step failed (continuing):", err.message)
  );

  const holders = await fetchHolders(connection, config.mint, config.excludedOwners, config.minEligibleBalance);
  const totalEligibleSupply = holders.reduce((sum, h) => sum + BigInt(h.amount), 0n);

  const rewardsBalance = await connection.getBalance(config.rewardsVaultKeypair.publicKey);
  const rewardsPoolLamports = BigInt(Math.max(0, Math.round(rewardsBalance - VAULT_RESERVE_LAMPORTS)));

  const snapshotId = db.insertSnapshot({
    takenAt: startedAt,
    holderCount: holders.length,
    totalEligibleSupply: totalEligibleSupply.toString(),
    rewardsPoolLamports: rewardsPoolLamports.toString(),
  });
  db.insertHolders(snapshotId, holders);

  const payouts = computePayouts(holders, rewardsPoolLamports);
  console.log(
    `[scheduler] snapshot #${snapshotId}: ${holders.length} eligible holders, ${payouts.length} qualify for a payout this cycle`
  );

  if (payouts.length > 0) {
    const sent = await sendPayouts(connection, config.rewardsVaultKeypair, payouts);
    for (const s of sent) {
      db.insertDistribution(
        snapshotId,
        s.owner,
        s.amountLamports.toString(),
        s.signature,
        s.signature ? "sent" : "failed"
      );
    }
    const sentCount = sent.filter((s) => s.signature).length;
    console.log(`[scheduler] airdropped to ${sentCount}/${sent.length} holders`);
  }

  console.log(`[scheduler] cycle complete @ ${new Date().toISOString()}`);
}

export function startScheduler(db: SherwoodDb) {
  const config = loadConfig();
  const intervalMinutes = Math.max(1, Math.round(config.snapshotIntervalMs / 60_000));
  const expression = intervalMinutes === 60 ? "0 * * * *" : `*/${intervalMinutes} * * * *`;

  console.log(`[scheduler] running every ${intervalMinutes} minute(s) — cron "${expression}"`);

  cron.schedule(expression, () => {
    runFullCycle(db).catch((err) => console.error("[scheduler] cycle threw:", err));
  });

  // Run once immediately on boot instead of waiting for the first tick.
  runFullCycle(db).catch((err) => console.error("[scheduler] initial cycle threw:", err));
}
