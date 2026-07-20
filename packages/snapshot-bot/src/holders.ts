import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, unpackAccount } from "@solana/spl-token";
import type { HolderBalance } from "@sherwood/shared";

export async function detectTokenProgram(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error(`Mint ${mint.toBase58()} not found on this RPC`);
  return info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

/**
 * Snapshots every holder of `mint`, aggregating balances across multiple
 * token accounts owned by the same wallet, and excludes known non-holder
 * addresses (LP pool vaults, the treasury, burn address, etc) so the
 * protocol doesn't airdrop itself.
 */
export async function fetchHolders(
  connection: Connection,
  mint: PublicKey,
  excludedOwners: Set<string>,
  minEligibleBalance: bigint
): Promise<HolderBalance[]> {
  const programId = await detectTokenProgram(connection, mint);

  const accounts = await connection.getProgramAccounts(programId, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: mint.toBase58() } }],
  });

  const balances = new Map<string, bigint>();
  const representativeAccount = new Map<string, string>();

  for (const { pubkey, account } of accounts) {
    let unpacked;
    try {
      unpacked = unpackAccount(pubkey, account, programId);
    } catch {
      continue; // not a standard token account layout (e.g. a mint-owned PDA); skip
    }
    if (unpacked.isFrozen) continue;

    const owner = unpacked.owner.toBase58();
    if (excludedOwners.has(owner)) continue;

    balances.set(owner, (balances.get(owner) ?? 0n) + unpacked.amount);
    if (!representativeAccount.has(owner)) representativeAccount.set(owner, pubkey.toBase58());
  }

  const holders: HolderBalance[] = [];
  for (const [owner, amount] of balances) {
    if (amount < minEligibleBalance) continue;
    holders.push({ owner, tokenAccount: representativeAccount.get(owner)!, amount: amount.toString() });
  }
  return holders;
}
