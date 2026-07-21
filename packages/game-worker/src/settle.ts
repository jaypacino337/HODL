import { createHash } from "crypto";
import type { Side } from "@hodl/shared";

export interface WeightedPlayer {
  wallet: string;
  side: Side;
  /** Raw token balance at settlement — bigger bags, bigger share. */
  weight: bigint;
}

export interface WinnerPayout {
  wallet: string;
  side: Side;
  weight: bigint;
  amountLamports: bigint;
}

// Below this, network fees eat the prize — roll the dust into the next pot.
const MIN_PAYOUT_LAMPORTS = 10_000n;

/**
 * The coin flip. Deterministic and publicly checkable: we hash the round
 * number together with a Solana blockhash fetched at settlement time —
 * a value nobody (including us) knows before the round locks. The blockhash
 * is stored on the round row so anyone can recompute:
 *
 *   sha256(`${blockhash}|round-${roundNumber}`)[0] is even  -> HODL
 *                                                otherwise  -> NOHODL
 */
export function decideWinningSide(decisionBlockhash: string, roundNumber: number): Side {
  const digest = createHash("sha256").update(`${decisionBlockhash}|round-${roundNumber}`).digest();
  return digest[0] % 2 === 0 ? "HODL" : "NOHODL";
}

/**
 * Splits `potLamports` among everyone on the winning side, proportional to
 * how much of the token each winner holds. Returns [] when nobody picked
 * the winning side — the pot simply stays in the vault and rolls into the
 * next round.
 */
export function computeWinnerPayouts(
  players: WeightedPlayer[],
  winningSide: Side,
  potLamports: bigint
): WinnerPayout[] {
  if (potLamports <= 0n) return [];

  const winners = players.filter((p) => p.side === winningSide && p.weight > 0n);
  const totalWeight = winners.reduce((sum, w) => sum + w.weight, 0n);
  if (totalWeight === 0n) return [];

  return winners
    .map((w) => ({
      wallet: w.wallet,
      side: w.side,
      weight: w.weight,
      amountLamports: (w.weight * potLamports) / totalWeight,
    }))
    .filter((w) => w.amountLamports >= MIN_PAYOUT_LAMPORTS);
}
