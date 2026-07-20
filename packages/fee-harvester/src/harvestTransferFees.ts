/**
 * Harvests Token-2022 TransferFee-extension fees for the self-launch path.
 * Two-step dance required by the token-2022 program:
 *   1. harvestWithheldTokensToMint: sweeps withheld fees sitting in individual
 *      token accounts into the mint's own withheld pool.
 *   2. withdrawWithheldTokensFromMint: moves the mint's withheld pool into a
 *      destination account the fee authority controls.
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getTransferFeeAmount,
  harvestWithheldTokensToMint,
  unpackAccount,
  withdrawWithheldTokensFromMint,
} from "@solana/spl-token";
import type { HarvestResult } from "@sherwood/shared";

async function findAccountsWithWithheldFees(
  connection: Connection,
  mint: PublicKey
): Promise<PublicKey[]> {
  const accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    commitment: "confirmed",
    filters: [
      { dataSize: 182 }, // base token-2022 account size with one extension; adjust if more extensions are added
      { memcmp: { offset: 0, bytes: mint.toBase58() } },
    ],
  });

  const withHeld: PublicKey[] = [];
  for (const { pubkey, account } of accounts) {
    try {
      const unpacked = unpackAccount(pubkey, account, TOKEN_2022_PROGRAM_ID);
      const feeAmount = getTransferFeeAmount(unpacked);
      if (feeAmount && feeAmount.withheldAmount > 0n) {
        withHeld.push(pubkey);
      }
    } catch {
      // Not a parseable token-2022 account with the expected extension layout; skip.
    }
  }
  return withHeld;
}

export async function harvestTransferFees(
  connection: Connection,
  mint: PublicKey,
  feeAuthority: Keypair,
  destination: PublicKey
): Promise<HarvestResult | null> {
  const sources = await findAccountsWithWithheldFees(connection, mint);
  if (sources.length > 0) {
    // Batch in chunks to stay comfortably under transaction size limits.
    const CHUNK = 20;
    for (let i = 0; i < sources.length; i += CHUNK) {
      const chunk = sources.slice(i, i + CHUNK);
      await harvestWithheldTokensToMint(connection, feeAuthority, mint, chunk, undefined, TOKEN_2022_PROGRAM_ID);
    }
  }

  const mintAccountBefore = await connection.getAccountInfo(mint);
  if (!mintAccountBefore) throw new Error("Mint account not found");

  const sig = await withdrawWithheldTokensFromMint(
    connection,
    feeAuthority,
    mint,
    destination,
    feeAuthority,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  const destBalance = await connection.getTokenAccountBalance(destination).catch(() => null);

  return {
    source: "token2022_transfer_fee",
    lamportsHarvested: destBalance?.value.amount ?? "0",
    signature: sig,
  };
}
