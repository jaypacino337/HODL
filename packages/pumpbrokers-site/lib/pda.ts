import { PublicKey } from "@solana/web3.js";
import {
  BUYBACK_PROGRAM_ID,
  MINT_PROGRAM_ID,
  SEEDS,
} from "../../../config";

export const mintProgramId = new PublicKey(MINT_PROGRAM_ID);
export const buybackProgramId = new PublicKey(BUYBACK_PROGRAM_ID);

const enc = (s: string) => Buffer.from(s, "utf8");

export const configPda = (): PublicKey =>
  PublicKey.findProgramAddressSync([enc(SEEDS.config)], mintProgramId)[0];

export const poolPda = (): PublicKey =>
  PublicKey.findProgramAddressSync([enc(SEEDS.pool)], mintProgramId)[0];

export const vaultPda = (): PublicKey =>
  PublicKey.findProgramAddressSync([enc(SEEDS.vault)], mintProgramId)[0];

export const treasuryPda = (): PublicKey =>
  PublicKey.findProgramAddressSync(
    [enc(SEEDS.treasury), configPda().toBuffer()],
    mintProgramId,
  )[0];

export const buybackConfigPda = (): PublicKey =>
  PublicKey.findProgramAddressSync([enc(SEEDS.buyback)], buybackProgramId)[0];

/**
 * A broker's asset address is derived from its sequential mint number, so any
 * broker can be looked up without an indexer. `mintNumber` is 0-based; the
 * displayed "#N" is `mintNumber + 1`.
 */
export const assetPda = (mintNumber: number): PublicKey => {
  const n = Buffer.alloc(2);
  n.writeUInt16LE(mintNumber, 0);
  return PublicKey.findProgramAddressSync(
    [enc(SEEDS.asset), configPda().toBuffer(), n],
    mintProgramId,
  )[0];
};
