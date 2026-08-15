/**
 * Hand-built Anchor instructions.
 *
 * The alternative is shipping @coral-xyz/anchor plus both IDLs to the browser, which
 * is several hundred kB to encode a discriminator and a u16. These are small enough to
 * write out, and `tests/discriminators.test.ts` re-derives every constant below from
 * `sha256("global:<name>")` so a rename in the program fails a test rather than
 * silently sending an instruction nobody handles.
 */
import {
  PublicKey,
  SystemProgram,
  SYSVAR_SLOT_HASHES_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { MPL_CORE_PROGRAM_ID } from "../../../config/index.ts";
import {
  assetPda,
  buybackConfigPda,
  buybackProgramId,
  configPda,
  mintProgramId,
  poolPda,
  treasuryPda,
  vaultPda,
} from "./pda.ts";

/** sha256("global:<snake_case_fn_name>")[0..8] */
export const DISCRIMINATOR = {
  initialize: [175, 175, 109, 31, 13, 152, 155, 237],
  init_pool: [116, 233, 199, 204, 115, 159, 171, 36],
  set_active: [29, 16, 225, 132, 38, 216, 206, 33],
  mint: [51, 57, 225, 47, 182, 146, 137, 166],
  remint: [32, 58, 59, 116, 18, 95, 172, 93],
  reveal: [9, 35, 59, 190, 167, 249, 76, 115],
  set_redeemer: [27, 97, 42, 75, 13, 148, 191, 129],
  return_to_pool: [36, 85, 39, 183, 30, 172, 176, 72],
  payout: [149, 140, 194, 236, 174, 189, 6, 239],
  transfer_authority: [48, 169, 76, 72, 229, 180, 55, 161],
  accept_authority: [107, 86, 198, 91, 33, 12, 107, 160],
  withdraw_treasury: [40, 63, 122, 158, 144, 216, 83, 96],
  set_payout_amount: [159, 47, 40, 108, 129, 39, 243, 27],
  redeem: [184, 12, 86, 149, 70, 196, 97, 225],
} as const;

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const mplCoreProgramId = new PublicKey(MPL_CORE_PROGRAM_ID);

const disc = (name: keyof typeof DISCRIMINATOR) =>
  Buffer.from(DISCRIMINATOR[name] as unknown as number[]);

const u16le = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
};

const u64le = (n: bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n, 0);
  return b;
};

const ro = (pubkey: PublicKey) => ({ pubkey, isSigner: false, isWritable: false });
const rw = (pubkey: PublicKey) => ({ pubkey, isSigner: false, isWritable: true });
const signer = (pubkey: PublicKey, isWritable = true) => ({
  pubkey,
  isSigner: true,
  isWritable,
});

/**
 * Public mint.
 *
 * `expectedNumber` must be the current `minted` count. If someone else lands first the
 * program returns MintRaced and the client retries with the new number — see
 * `mintWithRetry` in useMint.ts.
 */
export function mintIx(params: {
  minter: PublicKey;
  minterTokenAccount: PublicKey;
  paymentMint: PublicKey;
  collection: PublicKey;
  expectedNumber: number;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: mintProgramId,
    keys: [
      signer(params.minter),
      rw(configPda()),
      rw(poolPda()),
      ro(params.paymentMint),
      rw(params.minterTokenAccount),
      rw(treasuryPda()),
      rw(assetPda(params.expectedNumber)),
      rw(params.collection),
      ro(mplCoreProgramId),
      ro(SYSVAR_SLOT_HASHES_PUBKEY),
      ro(TOKEN_PROGRAM_ID),
      ro(SystemProgram.programId),
    ],
    data: Buffer.concat([disc("mint"), u16le(params.expectedNumber)]),
  });
}

/** Re-mint a broker that came back through the buyback program. */
export function remintIx(params: {
  minter: PublicKey;
  minterTokenAccount: PublicKey;
  paymentMint: PublicKey;
  collection: PublicKey;
  mintNumber: number;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: mintProgramId,
    keys: [
      signer(params.minter),
      ro(configPda()),
      rw(vaultPda()),
      ro(params.paymentMint),
      rw(params.minterTokenAccount),
      rw(treasuryPda()),
      rw(assetPda(params.mintNumber)),
      rw(params.collection),
      ro(mplCoreProgramId),
      ro(TOKEN_PROGRAM_ID),
      ro(SystemProgram.programId),
    ],
    data: Buffer.concat([disc("remint"), u16le(params.mintNumber)]),
  });
}

/** Sell a broker back to the treasury. */
export function redeemIx(params: {
  holder: PublicKey;
  holderTokenAccount: PublicKey;
  paymentMint: PublicKey;
  collection: PublicKey;
  mintNumber: number;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: buybackProgramId,
    keys: [
      signer(params.holder),
      rw(buybackConfigPda()),
      rw(configPda()),
      rw(vaultPda()),
      rw(assetPda(params.mintNumber)),
      rw(params.collection),
      ro(params.paymentMint),
      rw(treasuryPda()),
      rw(params.holderTokenAccount),
      ro(mintProgramId),
      ro(mplCoreProgramId),
      ro(TOKEN_PROGRAM_ID),
      ro(SystemProgram.programId),
    ],
    data: Buffer.concat([disc("redeem"), u16le(params.mintNumber)]),
  });
}

/** LAUNCH DAY. One instruction, signed by the authority's connected wallet. */
export function setActiveIx(authority: PublicKey, active: boolean): TransactionInstruction {
  return new TransactionInstruction({
    programId: mintProgramId,
    keys: [signer(authority, false), rw(configPda()), ro(poolPda())],
    data: Buffer.concat([disc("set_active"), Buffer.from([active ? 1 : 0])]),
  });
}

/** Connect (or disconnect) the buyback program. `null` kills redemption instantly. */
export function setRedeemerIx(
  authority: PublicKey,
  redeemer: PublicKey | null,
): TransactionInstruction {
  const payload = redeemer
    ? Buffer.concat([Buffer.from([1]), redeemer.toBuffer()])
    : Buffer.from([0]);
  return new TransactionInstruction({
    programId: mintProgramId,
    keys: [signer(authority, false), rw(configPda()), ro(poolPda())],
    data: Buffer.concat([disc("set_redeemer"), payload]),
  });
}

export function withdrawTreasuryIx(params: {
  authority: PublicKey;
  paymentMint: PublicKey;
  destination: PublicKey;
  amount: bigint;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: mintProgramId,
    keys: [
      signer(params.authority, false),
      ro(configPda()),
      ro(params.paymentMint),
      rw(treasuryPda()),
      rw(params.destination),
      ro(TOKEN_PROGRAM_ID),
    ],
    data: Buffer.concat([disc("withdraw_treasury"), u64le(params.amount)]),
  });
}
