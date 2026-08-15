import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Verifies that a submitted transaction signature really paid `minLamports`
 * to the treasury — how ad bookings are confirmed. The buyer pays from any
 * wallet, submits the signature, and the chain is the receipt.
 */
export async function verifyPaymentToTreasury(
  connection: Connection,
  txSignature: string,
  treasury: PublicKey,
  minLamports: bigint
): Promise<{ ok: boolean; reason: string }> {
  const tx = await connection.getTransaction(txSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) return { ok: false, reason: "transaction not found (wait for confirmation and retry)" };
  if (tx.meta?.err) return { ok: false, reason: "transaction failed on-chain" };

  const keys = tx.transaction.message.getAccountKeys().staticAccountKeys;
  const idx = keys.findIndex((k) => k.equals(treasury));
  if (idx === -1) return { ok: false, reason: "transaction does not touch the treasury" };

  const received = BigInt(tx.meta!.postBalances[idx]) - BigInt(tx.meta!.preBalances[idx]);
  if (received < minLamports) {
    return { ok: false, reason: `treasury received ${received} lamports, needs ${minLamports}` };
  }
  return { ok: true, reason: `received ${received} lamports` };
}
