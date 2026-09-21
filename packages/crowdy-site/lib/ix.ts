/**
 * Hand-built Anchor instructions for the Crowdy campaign program.
 *
 * Discriminators are sha256("global:<name>")[0..8]; `tests/unit/crowdy.test.ts`
 * re-derives every one and checks it names a `pub fn` that exists, so a rename in the
 * program fails a test rather than silently sending bytes nobody dispatches.
 */
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  campaignPda,
  contributionPda,
  platformPda,
  programId,
  vaultPda,
} from "./pda.ts";

export const DISCRIMINATOR = {
  initialize_platform: [119, 201, 101, 45, 75, 122, 89, 3],
  set_paused: [91, 60, 125, 192, 176, 225, 166, 218],
  update_gate: [249, 22, 182, 191, 62, 245, 168, 247],
  create_campaign: [111, 131, 187, 98, 160, 193, 114, 244],
  contribute: [82, 33, 68, 131, 32, 0, 205, 95],
  finalize: [171, 61, 218, 56, 127, 115, 12, 217],
  claim_funds: [145, 36, 143, 242, 168, 66, 200, 155],
  refund: [2, 96, 183, 251, 63, 208, 46, 46],
  cancel_campaign: [66, 10, 32, 138, 122, 36, 134, 202],
} as const;

const disc = (n: keyof typeof DISCRIMINATOR) =>
  Buffer.from(DISCRIMINATOR[n] as unknown as number[]);

const u64 = (n: bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n, 0);
  return b;
};
const i64 = (n: bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(n, 0);
  return b;
};
const str = (s: string) => {
  const body = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(body.length, 0);
  return Buffer.concat([len, body]);
};

const ro = (pubkey: PublicKey) => ({ pubkey, isSigner: false, isWritable: false });
const rw = (pubkey: PublicKey) => ({ pubkey, isSigner: false, isWritable: true });
const sig = (pubkey: PublicKey, isWritable = true) => ({
  pubkey,
  isSigner: true,
  isWritable,
});

/** "Let's do this." Holder-gated. */
export function createCampaignIx(p: {
  creator: PublicKey;
  creatorGateAccount: PublicKey;
  campaignId: number;
  title: string;
  summary: string;
  link: string;
  goalLamports: bigint;
  durationSeconds: number;
}): TransactionInstruction {
  const campaign = campaignPda(p.campaignId);
  return new TransactionInstruction({
    programId,
    keys: [
      sig(p.creator),
      rw(platformPda()),
      rw(campaign),
      rw(vaultPda(campaign)),
      ro(p.creatorGateAccount),
      ro(SystemProgram.programId),
    ],
    data: Buffer.concat([
      disc("create_campaign"),
      str(p.title),
      str(p.summary),
      str(p.link),
      u64(p.goalLamports),
      i64(BigInt(p.durationSeconds)),
    ]),
  });
}

/** Back a campaign. Holder-gated. Tops up an existing position. */
export function contributeIx(p: {
  backer: PublicKey;
  backerGateAccount: PublicKey;
  campaignId: number;
  amountLamports: bigint;
}): TransactionInstruction {
  const campaign = campaignPda(p.campaignId);
  return new TransactionInstruction({
    programId,
    keys: [
      sig(p.backer),
      ro(platformPda()),
      rw(campaign),
      rw(vaultPda(campaign)),
      rw(contributionPda(campaign, p.backer)),
      ro(p.backerGateAccount),
      ro(SystemProgram.programId),
    ],
    data: Buffer.concat([disc("contribute"), u64(p.amountLamports)]),
  });
}

/**
 * Settle a campaign. PERMISSIONLESS — any wallet can call it, which is what stops a
 * vanished creator from stranding backers in Active forever.
 */
export function finalizeIx(caller: PublicKey, campaignId: number): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [sig(caller, false), rw(campaignPda(campaignId))],
    data: disc("finalize"),
  });
}

/** Creator takes a funded campaign's proceeds, minus the platform fee. */
export function claimFundsIx(p: {
  creator: PublicKey;
  campaignId: number;
  feeDestination: PublicKey;
}): TransactionInstruction {
  const campaign = campaignPda(p.campaignId);
  return new TransactionInstruction({
    programId,
    keys: [
      sig(p.creator),
      ro(platformPda()),
      rw(campaign),
      rw(vaultPda(campaign)),
      rw(p.feeDestination),
      ro(SystemProgram.programId),
    ],
    data: disc("claim_funds"),
  });
}

/** Take your SOL back from a failed campaign. Exact amount, no fee. */
export function refundIx(backer: PublicKey, campaignId: number): TransactionInstruction {
  const campaign = campaignPda(campaignId);
  return new TransactionInstruction({
    programId,
    keys: [
      sig(backer),
      ro(campaign),
      rw(vaultPda(campaign)),
      rw(contributionPda(campaign, backer)),
      ro(SystemProgram.programId),
    ],
    data: disc("refund"),
  });
}

/** Creator pulls their own campaign, opening refunds immediately. */
export function cancelCampaignIx(
  creator: PublicKey,
  campaignId: number,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [sig(creator, false), rw(campaignPda(campaignId))],
    data: disc("cancel_campaign"),
  });
}

export function initializePlatformIx(p: {
  authority: PublicKey;
  gateMint: PublicKey;
  feeDestination: PublicKey;
  gateAmount: bigint;
  feeBps: number;
}): TransactionInstruction {
  const bps = Buffer.alloc(2);
  bps.writeUInt16LE(p.feeBps, 0);
  return new TransactionInstruction({
    programId,
    keys: [
      sig(p.authority),
      rw(platformPda()),
      ro(p.gateMint),
      ro(p.feeDestination),
      ro(SystemProgram.programId),
    ],
    data: Buffer.concat([disc("initialize_platform"), u64(p.gateAmount), bps]),
  });
}

export function setPausedIx(authority: PublicKey, paused: boolean): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [sig(authority, false), rw(platformPda())],
    data: Buffer.concat([disc("set_paused"), Buffer.from([paused ? 1 : 0])]),
  });
}
