/**
 * Server-side account reads.
 *
 * Accounts are decoded by hand rather than through the Anchor client. Every field we
 * need sits at a fixed offset (the two Strings are last, after everything else), so a
 * 40-line decoder replaces ~300kB of client bundle and one more thing to keep in sync.
 *
 * The byte offsets below are asserted against the programs by tests/layout.test.ts —
 * if a field is added to Config, that test fails rather than the site quietly showing
 * a wrong mint count.
 */
import { Connection, PublicKey } from "@solana/web3.js";

export const CONFIG_OFFSETS = {
  bump: 8,
  authority: 9,
  pendingAuthority: 41,
  paymentMint: 73,
  collection: 105,
  treasury: 137,
  price: 169,
  totalSupply: 177,
  honoraryCount: 179,
  minted: 181,
  isActive: 183,
  delayedReveal: 184,
  redeemer: 185,
  baseUri: 217,
} as const;

export const VAULT_OFFSETS = { bump: 8, queueLen: 9, queue: 13 } as const;

export const BUYBACK_OFFSETS = {
  bump: 8,
  authority: 9,
  pendingAuthority: 41,
  mintConfig: 73,
  paymentMint: 105,
  collection: 137,
  payoutAmount: 169,
  isActive: 177,
  redeemed: 178,
} as const;

export type MintConfig = {
  authority: string;
  paymentMint: string;
  collection: string;
  treasury: string;
  price: bigint;
  totalSupply: number;
  honoraryCount: number;
  minted: number;
  isActive: boolean;
  delayedReveal: boolean;
  redeemer: string | null;
};

const key = (b: Buffer, at: number) => new PublicKey(b.subarray(at, at + 32)).toBase58();
const SYSTEM = "11111111111111111111111111111111";

export function decodeMintConfig(data: Buffer): MintConfig {
  const o = CONFIG_OFFSETS;
  const redeemer = key(data, o.redeemer);
  return {
    authority: key(data, o.authority),
    paymentMint: key(data, o.paymentMint),
    collection: key(data, o.collection),
    treasury: key(data, o.treasury),
    price: data.readBigUInt64LE(o.price),
    totalSupply: data.readUInt16LE(o.totalSupply),
    honoraryCount: data.readUInt16LE(o.honoraryCount),
    minted: data.readUInt16LE(o.minted),
    isActive: data[o.isActive] === 1,
    delayedReveal: data[o.delayedReveal] === 1,
    // Pubkey::default() is the all-zero key — the program's "unset" sentinel.
    redeemer: redeemer === SYSTEM ? null : redeemer,
  };
}

/** Mint numbers sitting in the vault, re-mintable. FIFO — index 0 goes next. */
export function decodeVaultQueue(data: Buffer): number[] {
  const len = data.readUInt32LE(VAULT_OFFSETS.queueLen);
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    out.push(data.readUInt16LE(VAULT_OFFSETS.queue + i * 2));
  }
  return out;
}

export type BuybackConfig = {
  authority: string;
  payoutAmount: bigint;
  isActive: boolean;
  redeemed: number;
};

export function decodeBuybackConfig(data: Buffer): BuybackConfig {
  const o = BUYBACK_OFFSETS;
  return {
    authority: key(data, o.authority),
    payoutAmount: data.readBigUInt64LE(o.payoutAmount),
    isActive: data[o.isActive] === 1,
    redeemed: data.readUInt32LE(o.redeemed),
  };
}

/**
 * The Helius endpoint. Server-side only — this function must never be imported into
 * a client component, and the key has no NEXT_PUBLIC_ prefix so Next.js cannot inline
 * it into the browser bundle even by accident.
 */
export function rpcUrl(): string {
  const k = process.env.HELIUS_API_KEY;
  const cluster = process.env.NEXT_PUBLIC_CLUSTER === "mainnet-beta" ? "mainnet" : "devnet";
  if (!k) {
    return cluster === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";
  }
  return `https://${cluster}.helius-rpc.com/?api-key=${k}`;
}

export function connection(): Connection {
  return new Connection(rpcUrl(), "confirmed");
}
