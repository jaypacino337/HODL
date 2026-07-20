import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const MIN_SPLIT_LAMPORTS = 0.002 * LAMPORTS_PER_SOL; // skip dust below rent-exemption-ish threshold

export interface SplitResult {
  toLp: bigint;
  toRewards: bigint;
  signature: string | null;
}

/**
 * Splits the fee-authority wallet's spendable SOL balance between the LP
 * vault and the rewards vault, leaving `reserveLamports` behind to cover
 * this wallet's own future transaction fees.
 */
export async function splitHarvestedFees(
  connection: Connection,
  feeAuthority: Keypair,
  lpVault: PublicKey,
  rewardsVault: PublicKey,
  lpShare: number,
  reserveLamports = 0.02 * LAMPORTS_PER_SOL
): Promise<SplitResult> {
  const balance = await connection.getBalance(feeAuthority.publicKey);
  const spendable = BigInt(Math.max(0, Math.round(balance - reserveLamports)));

  if (spendable < BigInt(MIN_SPLIT_LAMPORTS)) {
    return { toLp: 0n, toRewards: 0n, signature: null };
  }

  const toLp = (spendable * BigInt(Math.round(lpShare * 10_000))) / 10_000n;
  const toRewards = spendable - toLp;

  const tx = new Transaction();
  if (toLp > 0n) {
    tx.add(SystemProgram.transfer({ fromPubkey: feeAuthority.publicKey, toPubkey: lpVault, lamports: toLp }));
  }
  if (toRewards > 0n) {
    tx.add(SystemProgram.transfer({ fromPubkey: feeAuthority.publicKey, toPubkey: rewardsVault, lamports: toRewards }));
  }
  if (tx.instructions.length === 0) {
    return { toLp: 0n, toRewards: 0n, signature: null };
  }

  const signature = await sendAndConfirmTransaction(connection, tx, [feeAuthority]);
  return { toLp, toRewards, signature };
}
