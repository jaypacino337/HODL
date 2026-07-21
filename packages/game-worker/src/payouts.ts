import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import type { WinnerPayout } from "./settle";

export interface SentPayout extends WinnerPayout {
  signature: string | null;
}

// Legacy transactions cap at 1232 bytes; 10 system transfers per tx leaves
// headroom for the blockhash, fee-payer signature, and future compute ixs.
const CHUNK_SIZE = 10;

/** Pays winners in batches straight from the game vault. */
export async function sendPayouts(
  connection: Connection,
  gameVault: Keypair,
  payouts: WinnerPayout[]
): Promise<SentPayout[]> {
  const results: SentPayout[] = [];

  for (let i = 0; i < payouts.length; i += CHUNK_SIZE) {
    const chunk = payouts.slice(i, i + CHUNK_SIZE);
    const tx = new Transaction();
    for (const p of chunk) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: gameVault.publicKey,
          toPubkey: new PublicKey(p.wallet),
          lamports: p.amountLamports,
        })
      );
    }

    try {
      const signature = await sendAndConfirmTransaction(connection, tx, [gameVault]);
      chunk.forEach((p) => results.push({ ...p, signature }));
    } catch (err) {
      console.error(`[payouts] batch [${i}, ${i + chunk.length}) failed:`, (err as Error).message);
      chunk.forEach((p) => results.push({ ...p, signature: null }));
    }
  }

  return results;
}
