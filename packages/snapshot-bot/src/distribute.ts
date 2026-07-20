import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import type { HolderBalance } from "@sherwood/shared";

export interface Payout {
  owner: string;
  amountLamports: bigint;
}

export interface PayoutResult extends Payout {
  signature: string | null;
}

// Conservative batch size: legacy transactions cap at 1232 bytes; a system
// transfer ix is ~34 bytes plus account keys, so 10 per tx leaves headroom
// for the blockhash, fee payer signature, and any future memo/compute ixs.
const CHUNK_SIZE = 10;

// Below this, the SOL transfer would cost more in network fees than a
// holder actually receives — skip it rather than waste rewards-pool funds.
const MIN_PAYOUT_LAMPORTS = 1_000n;

export function computePayouts(holders: HolderBalance[], rewardsPoolLamports: bigint): Payout[] {
  if (rewardsPoolLamports <= 0n || holders.length === 0) return [];

  const totalEligibleSupply = holders.reduce((sum, h) => sum + BigInt(h.amount), 0n);
  if (totalEligibleSupply === 0n) return [];

  return holders
    .map((h) => ({
      owner: h.owner,
      amountLamports: (BigInt(h.amount) * rewardsPoolLamports) / totalEligibleSupply,
    }))
    .filter((p) => p.amountLamports >= MIN_PAYOUT_LAMPORTS);
}

export async function sendPayouts(
  connection: Connection,
  rewardsVault: Keypair,
  payouts: Payout[]
): Promise<PayoutResult[]> {
  const results: PayoutResult[] = [];

  for (let i = 0; i < payouts.length; i += CHUNK_SIZE) {
    const chunk = payouts.slice(i, i + CHUNK_SIZE);
    const tx = new Transaction();
    for (const p of chunk) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: rewardsVault.publicKey,
          toPubkey: new PublicKey(p.owner),
          lamports: p.amountLamports,
        })
      );
    }

    try {
      const signature = await sendAndConfirmTransaction(connection, tx, [rewardsVault]);
      chunk.forEach((p) => results.push({ ...p, signature }));
    } catch (err) {
      console.error(`[distribute] payout batch [${i}, ${i + chunk.length}) failed:`, (err as Error).message);
      chunk.forEach((p) => results.push({ ...p, signature: null }));
    }
  }

  return results;
}
