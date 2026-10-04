/**
 * Account decoding.
 *
 * Campaign holds three Strings in the middle of the struct, so fixed byte offsets do
 * not work past `creator` — this reads the account sequentially instead, which is both
 * correct and about 40 lines. The alternative is shipping the Anchor client and both
 * IDLs to the browser to decode two numbers.
 */
import { Connection, PublicKey } from "@solana/web3.js";

export class Reader {
  // Explicit fields rather than TypeScript parameter properties: the test suite runs
  // these modules under Node's strip-only type removal, which does not support
  // `constructor(private buf: Buffer)`.
  private buf: Buffer;
  private o: number;

  constructor(buf: Buffer, start = 8 /* skip the Anchor discriminator */) {
    this.buf = buf;
    this.o = start;
  }
  u8(): number {
    return this.buf[this.o++];
  }
  bool(): boolean {
    return this.u8() === 1;
  }
  u16(): number {
    const v = this.buf.readUInt16LE(this.o);
    this.o += 2;
    return v;
  }
  u32(): number {
    const v = this.buf.readUInt32LE(this.o);
    this.o += 4;
    return v;
  }
  u64(): bigint {
    const v = this.buf.readBigUInt64LE(this.o);
    this.o += 8;
    return v;
  }
  i64(): bigint {
    const v = this.buf.readBigInt64LE(this.o);
    this.o += 8;
    return v;
  }
  key(): string {
    const v = new PublicKey(this.buf.subarray(this.o, this.o + 32)).toBase58();
    this.o += 32;
    return v;
  }
  str(): string {
    const len = this.u32();
    const v = this.buf.subarray(this.o, this.o + len).toString("utf8");
    this.o += len;
    return v;
  }
}

export const STATUS = ["Active", "Funded", "Failed", "Claimed"] as const;
export type Status = (typeof STATUS)[number];

export type Platform = {
  authority: string;
  gateMint: string;
  gateAmount: bigint;
  feeBps: number;
  feeDestination: string;
  campaignCount: number;
  paused: boolean;
};

export function decodePlatform(data: Buffer): Platform {
  const r = new Reader(data);
  r.u8(); // bump
  return {
    authority: r.key(),
    gateMint: r.key(),
    gateAmount: r.u64(),
    feeBps: r.u16(),
    feeDestination: r.key(),
    campaignCount: Number(r.u64()),
    paused: r.bool(),
  };
}

export type Campaign = {
  id: number;
  address: string;
  creator: string;
  title: string;
  summary: string;
  link: string;
  goal: bigint;
  raised: bigint;
  backerCount: number;
  createdAt: number;
  deadline: number;
  status: Status;
};

export function decodeCampaign(data: Buffer, address: string): Campaign {
  const r = new Reader(data);
  r.u8(); // bump
  r.u8(); // vault_bump
  return {
    id: Number(r.u64()),
    address,
    creator: r.key(),
    title: r.str(),
    summary: r.str(),
    link: r.str(),
    goal: r.u64(),
    raised: r.u64(),
    backerCount: r.u32(),
    createdAt: Number(r.i64()),
    deadline: Number(r.i64()),
    status: STATUS[r.u8()] ?? "Active",
  };
}

export type Contribution = {
  campaign: string;
  backer: string;
  amount: bigint;
  refunded: boolean;
};

export function decodeContribution(data: Buffer): Contribution {
  const r = new Reader(data);
  r.u8();
  return {
    campaign: r.key(),
    backer: r.key(),
    amount: r.u64(),
    refunded: r.bool(),
  };
}

/**
 * Server-side only. `HELIUS_API_KEY` has no NEXT_PUBLIC_ prefix, so Next.js cannot
 * inline it into the client bundle even by mistake.
 */
export function rpcUrl(): string {
  const k = process.env.HELIUS_API_KEY;
  const net = process.env.NEXT_PUBLIC_CLUSTER === "mainnet-beta" ? "mainnet" : "devnet";
  if (!k) {
    return net === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";
  }
  return `https://${net}.helius-rpc.com/?api-key=${k}`;
}

export const connection = () => new Connection(rpcUrl(), "confirmed");
