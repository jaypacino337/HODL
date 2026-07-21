import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

/**
 * Sums a wallet's balance of `mint` across all of its token accounts.
 * pump.fun mints are classic SPL, but the Token-2022 pass costs one extra
 * RPC call and future-proofs the check.
 */
export async function getWalletTokenBalance(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey
): Promise<bigint> {
  let total = 0n;
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const res = await connection
      .getParsedTokenAccountsByOwner(owner, { mint, programId })
      .catch(() => ({ value: [] as any[] }));
    for (const { account } of res.value) {
      const amount = account.data?.parsed?.info?.tokenAmount?.amount;
      if (amount) total += BigInt(amount);
    }
  }
  return total;
}

export async function getMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const info = await connection.getParsedAccountInfo(mint);
  const parsed: any = info.value?.data;
  const decimals = parsed?.parsed?.info?.decimals;
  if (typeof decimals !== "number") {
    throw new Error(`Could not read decimals for mint ${mint.toBase58()} — wrong RPC or bad MINT_ADDRESS?`);
  }
  return decimals;
}

/** Whole-token threshold -> raw base units, given the mint's decimals. */
export function minHoldRaw(minHoldTokens: number, decimals: number): bigint {
  return BigInt(minHoldTokens) * 10n ** BigInt(decimals);
}
