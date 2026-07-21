import { Connection, PublicKey } from "@solana/web3.js";
import { HodlConfig } from "@hodl/shared";
import { harvestPumpFunCreatorFees } from "@hodl/fee-harvester";
import { GameDb } from "./db";
import { getWalletTokenBalance, minHoldRaw } from "./balances";
import { computeWinnerPayouts, decideWinningSide, WeightedPlayer } from "./settle";
import { sendPayouts } from "./payouts";

/**
 * One full tick of the game, run every ROUND_INTERVAL_MS (15 minutes):
 *
 *   1. CLAIM   — pull accrued pump.fun creator fees into the game vault.
 *   2. SETTLE  — flip the coin for the round that just ended, and pay the
 *                winning side pro-rata by how much each winner holds.
 *   3. OPEN    — start the next round so picks can come in immediately.
 *
 * If nobody picked the winning side, nothing is paid and the vault balance
 * (the pot) automatically rolls into the next round.
 */
export async function runGameCycle(
  config: HodlConfig,
  connection: Connection,
  db: GameDb,
  tokenDecimals: number
): Promise<void> {
  const startedAt = new Date();
  console.log(`[engine] cycle starting @ ${startedAt.toISOString()}`);

  // ── 1. CLAIM ──────────────────────────────────────────────────────────
  try {
    const claims = await harvestPumpFunCreatorFees(connection, config.gameVaultKeypair);
    for (const c of claims) {
      await db.insertFeeClaim(c.source, c.lamportsHarvested, c.signature);
      console.log(`[engine] claimed ${c.lamportsHarvested} lamports of creator fees (${c.signature})`);
    }
    if (claims.length === 0) console.log("[engine] no creator fees to claim this cycle");
  } catch (err) {
    console.error("[engine] fee claim failed (continuing with existing pot):", (err as Error).message);
  }

  // ── 2. SETTLE ─────────────────────────────────────────────────────────
  const openRound = await db.getOpenRound();
  if (openRound && new Date(openRound.settlesAt).getTime() <= Date.now()) {
    await settleRound(config, connection, db, tokenDecimals, openRound.id, openRound.roundNumber);
  }

  // ── 3. OPEN ───────────────────────────────────────────────────────────
  await ensureOpenRound(config, db);

  console.log(`[engine] cycle complete @ ${new Date().toISOString()}`);
}

async function settleRound(
  config: HodlConfig,
  connection: Connection,
  db: GameDb,
  tokenDecimals: number,
  roundId: number,
  roundNumber: number
): Promise<void> {
  const picks = await db.getPicks(roundId);

  // The pot is whatever the vault holds beyond its fee reserve, at the
  // moment of settlement — fees claimed this cycle plus any rollover.
  const vaultBalance = await connection.getBalance(config.gameVaultKeypair.publicKey);
  const pot = BigInt(Math.max(0, vaultBalance - config.vaultReserveLamports));

  // Nobody knows this value before the round locks, which is what makes
  // the flip fair. Stored on the round so anyone can recompute the result.
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  const winningSide = decideWinningSide(blockhash, roundNumber);

  console.log(
    `[engine] settling round #${roundNumber}: ${picks.length} picks, pot ${pot} lamports, blockhash ${blockhash} -> ${winningSide}`
  );

  // Re-check balances at settlement so the weight (score) reflects what
  // each player actually holds NOW — sell after picking, lose your weight.
  const threshold = minHoldRaw(config.minHoldTokens, tokenDecimals);
  const players: WeightedPlayer[] = [];
  for (const pick of picks) {
    if (config.excludedOwners.has(pick.wallet)) continue;
    try {
      const balance = await getWalletTokenBalance(connection, config.mint, new PublicKey(pick.wallet));
      if (balance >= threshold) {
        players.push({ wallet: pick.wallet, side: pick.side, weight: balance });
      } else {
        console.log(`[engine] ${pick.wallet} dropped below ${config.minHoldTokens} tokens — pick voided`);
      }
    } catch (err) {
      console.error(`[engine] balance check failed for ${pick.wallet}:`, (err as Error).message);
    }
  }

  const payouts = computeWinnerPayouts(players, winningSide, pot);

  await db.settleRound(roundId, {
    potLamports: pot.toString(),
    winningSide,
    decisionBlockhash: blockhash,
  });

  if (payouts.length === 0) {
    console.log(`[engine] round #${roundNumber}: no eligible winners on ${winningSide} — pot rolls over`);
    return;
  }

  const sent = await sendPayouts(connection, config.gameVaultKeypair, payouts);
  await db.insertPayouts(
    sent.map((s) => ({
      roundId,
      wallet: s.wallet,
      side: s.side,
      weight: s.weight.toString(),
      amountLamports: s.amountLamports.toString(),
      txSignature: s.signature,
      status: s.signature ? ("sent" as const) : ("failed" as const),
    }))
  );
  const okCount = sent.filter((s) => s.signature).length;
  const paid = sent.filter((s) => s.signature).reduce((sum, s) => sum + s.amountLamports, 0n);
  console.log(`[engine] round #${roundNumber}: paid ${paid} lamports to ${okCount}/${sent.length} winners on ${winningSide}`);
}

/** Opens the next round if none is open. Safe to call repeatedly. */
export async function ensureOpenRound(config: HodlConfig, db: GameDb): Promise<void> {
  const existing = await db.getOpenRound();
  if (existing) return;

  const roundNumber = (await db.getLastRoundNumber()) + 1;
  const now = new Date();
  const settlesAt = new Date(now.getTime() + config.roundIntervalMs);
  const locksAt = new Date(settlesAt.getTime() - config.pickLockBufferMs);
  const round = await db.createRound(roundNumber, now, locksAt, settlesAt);
  console.log(`[engine] opened round #${round.roundNumber}, settles ${settlesAt.toISOString()}`);
}
