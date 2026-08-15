import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { AttnConfig, EpochPayout } from "@attn/shared";
import { harvestPumpFunCreatorFees } from "@attn/fee-harvester";
import { AttnDb } from "./db";
import { executeBuyback } from "./buyback";
import { runScan } from "./scanner";

/**
 * CLAIM cycle (every 15 min): pull accrued creator fees into the treasury
 * and split them on the ledger — FEE_BUYBACK_SHARE (50%) to the buyback
 * pool, the rest credited to the open epoch's attention-rewards pool.
 */
export async function runClaimCycle(config: AttnConfig, connection: Connection, db: AttnDb): Promise<void> {
  console.log(`[claim] cycle @ ${new Date().toISOString()}`);
  try {
    const claims = await harvestPumpFunCreatorFees(connection, config.treasuryKeypair);
    if (claims.length === 0) {
      console.log("[claim] nothing accrued this cycle");
      return;
    }
    const epoch = await ensureOpenEpoch(config, db);
    for (const c of claims) {
      await db.insertFeeClaim(c.source, c.lamportsHarvested, c.signature);
      const total = BigInt(c.lamportsHarvested);
      const toBuyback = (total * BigInt(Math.round(config.feeBuybackShare * 10_000))) / 10_000n;
      const toRewards = total - toBuyback;
      await db.insertLedger("buyback", toBuyback, "fee claim split", c.signature);
      await db.creditEpochRewards(epoch.id, epoch.rewardsPoolLamports, toRewards);
      epoch.rewardsPoolLamports = (BigInt(epoch.rewardsPoolLamports) + toRewards).toString();
      console.log(`[claim] +${total} lamports -> buyback ${toBuyback}, rewards ${toRewards} (${c.signature})`);
    }
  } catch (err) {
    console.error("[claim] failed (funds untouched):", (err as Error).message);
  }
}

/**
 * BUYBACK cycle (every 4h): spend the accumulated buyback pool on the
 * open market, bounded by what the treasury actually holds beyond its
 * reserve. Every attempt is recorded, including skips.
 */
export async function runBuybackCycle(config: AttnConfig, connection: Connection, db: AttnDb): Promise<void> {
  try {
    const pool = await db.poolBalance("buyback");
    const treasuryBalance = BigInt(await connection.getBalance(config.treasuryKeypair.publicKey));
    const spendable = min3(pool, treasuryBalance - BigInt(config.treasuryReserveLamports));
    if (spendable < 10_000_000n) {
      // Under 0.01 SOL: not worth the fees; let it accumulate.
      return;
    }
    console.log(`[buyback] executing ${spendable} lamports`);
    const result = await executeBuyback(connection, config.treasuryKeypair, config.mint, spendable);
    await db.insertBuyback({
      lamportsSpent: result.status === "sent" ? spendable.toString() : "0",
      tokensBought: null,
      txSignature: result.signature,
      status: result.status,
      note: result.note,
    });
    if (result.status === "sent") {
      await db.insertLedger("buyback", -spendable, "buyback executed", result.signature ?? undefined);
      console.log(`[buyback] done: ${result.signature}`);
    } else {
      console.warn(`[buyback] ${result.status}: ${result.note}`);
    }
  } catch (err) {
    console.error("[buyback] cycle failed:", (err as Error).message);
  }
}

/** SCAN cycle (hourly): run the attention scanner and persist the results. */
export async function runScanCycle(config: AttnConfig, db: AttnDb): Promise<void> {
  try {
    const { items, sources } = await runScan(config);
    await db.insertScan(items, sources);
    console.log(
      `[scan] stored ${items.length} items — ` +
        sources.map((s) => `${s.source}:${s.status}`).join(" ")
    );
  } catch (err) {
    console.error("[scan] failed:", (err as Error).message);
  }
}

/**
 * EPOCH cycle (checked every few minutes): when the open epoch ends, pay
 * its rewards pool pro-rata to everyone's approved attention points that
 * epoch, then open the next epoch. No approved points -> the pool rolls
 * into the next epoch.
 */
export async function runEpochCycle(config: AttnConfig, connection: Connection, db: AttnDb): Promise<void> {
  const epoch = await ensureOpenEpoch(config, db);
  if (new Date(epoch.endsAt).getTime() > Date.now()) return;

  console.log(`[epoch] closing epoch #${epoch.id}`);
  const pool = BigInt(epoch.rewardsPoolLamports);
  const pointsByWallet = await db.epochPoints(epoch.id);
  const totalPoints = [...pointsByWallet.values()].reduce((a, b) => a + b, 0);

  await db.markEpochPaid(epoch.id);
  const next = await db.createEpoch(new Date(Date.now() + config.epochLengthMs));

  if (pool === 0n || totalPoints === 0) {
    if (pool > 0n) {
      await db.creditEpochRewards(next.id, next.rewardsPoolLamports, pool);
      console.log(`[epoch] no approved points — ${pool} lamports roll into epoch #${next.id}`);
    }
    return;
  }

  const payouts: Array<{ wallet: string; points: number; amount: bigint }> = [];
  for (const [wallet, points] of pointsByWallet) {
    const amount = (pool * BigInt(points)) / BigInt(totalPoints);
    if (amount >= 10_000n) payouts.push({ wallet, points, amount });
  }

  const results: EpochPayout[] = [];
  for (let i = 0; i < payouts.length; i += 10) {
    const chunk = payouts.slice(i, i + 10);
    const tx = new Transaction();
    for (const p of chunk) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: config.treasuryKeypair.publicKey,
          toPubkey: new PublicKey(p.wallet),
          lamports: p.amount,
        })
      );
    }
    try {
      const signature = await sendAndConfirmTransaction(connection, tx, [config.treasuryKeypair]);
      chunk.forEach((p) =>
        results.push({
          epochId: epoch.id,
          wallet: p.wallet,
          points: p.points,
          amountLamports: p.amount.toString(),
          txSignature: signature,
          status: "sent",
        })
      );
    } catch (err) {
      console.error(`[epoch] payout batch failed:`, (err as Error).message);
      chunk.forEach((p) =>
        results.push({
          epochId: epoch.id,
          wallet: p.wallet,
          points: p.points,
          amountLamports: p.amount.toString(),
          txSignature: null,
          status: "failed",
        })
      );
    }
  }
  await db.insertEpochPayouts(results);
  const paid = results.filter((r) => r.status === "sent");
  console.log(`[epoch] paid ${paid.length}/${results.length} contributors from a ${pool}-lamport pool`);
}

/** Expire ads whose run has ended. Called alongside the epoch check. */
export async function runAdExpiry(db: AttnDb): Promise<void> {
  const ads = await db.activeAds();
  for (const ad of ads) {
    if (ad.endsAt && new Date(ad.endsAt).getTime() < Date.now()) {
      await db.setAdStatus(ad.id, "expired");
      console.log(`[ads] ad #${ad.id} expired`);
    }
  }
}

export async function ensureOpenEpoch(config: AttnConfig, db: AttnDb) {
  const open = await db.getOpenEpoch();
  if (open) return open;
  const epoch = await db.createEpoch(new Date(Date.now() + config.epochLengthMs));
  console.log(`[epoch] opened epoch #${epoch.id}, ends ${epoch.endsAt}`);
  return epoch;
}

function min3(a: bigint, b: bigint): bigint {
  const m = a < b ? a : b;
  return m < 0n ? 0n : m;
}
