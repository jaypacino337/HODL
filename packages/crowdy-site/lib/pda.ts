import { PublicKey } from "@solana/web3.js";
import { CAMPAIGN_PROGRAM_ID, SEEDS } from "../../../config/crowdy.ts";

export const programId = new PublicKey(CAMPAIGN_PROGRAM_ID);

const enc = (s: string) => Buffer.from(s, "utf8");

const u64le = (n: number | bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n), 0);
  return b;
};

export const platformPda = (): PublicKey =>
  PublicKey.findProgramAddressSync([enc(SEEDS.platform)], programId)[0];

/**
 * Campaigns are addressed by a sequential id, so the whole list can be read by
 * deriving 0..campaignCount and batching — no indexer, no getProgramAccounts scan.
 */
export const campaignPda = (id: number | bigint): PublicKey =>
  PublicKey.findProgramAddressSync([enc(SEEDS.campaign), u64le(id)], programId)[0];

export const vaultPda = (campaign: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync([enc(SEEDS.vault), campaign.toBuffer()], programId)[0];

export const contributionPda = (campaign: PublicKey, backer: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [enc(SEEDS.contribution), campaign.toBuffer(), backer.toBuffer()],
    programId,
  )[0];

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

/** The gate-token account we check eligibility against. */
export const ata = (owner: PublicKey, mint: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
