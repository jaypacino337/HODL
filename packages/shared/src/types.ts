export interface HarvestResult {
  source: "pumpfun_creator_fee";
  lamportsHarvested: string;
  signature: string;
}

// ── Attention scanner ────────────────────────────────────────────────────

export type ScanSource = "dexscreener" | "coingecko" | "news" | "tiktok";

export interface ScanItem {
  rank: number;
  source: ScanSource;
  symbol: string;
  name: string;
  /** 0-100 composite attention score. */
  score: number;
  priceUsd: number | null;
  change24h: number | null;
  volume24hUsd: number | null;
  url: string | null;
}

export interface SourceStatus {
  source: ScanSource;
  status: "live" | "needs_key" | "error";
  detail: string;
}

export interface ScanResponse {
  ranAt: string | null;
  items: ScanItem[];
  sources: SourceStatus[];
}

// ── Attention points ─────────────────────────────────────────────────────

export type PostStatus = "pending" | "approved" | "denied";

export interface SocialPost {
  id: number;
  wallet: string;
  url: string;
  status: PostStatus;
  points: number;
  submittedAt: string;
  reviewedAt: string | null;
  note: string | null;
}

export interface AttentionRank {
  wallet: string;
  lifetimePoints: number;
  epochPoints: number;
  approvedPosts: number;
}

/** Lifetime-points tiers shown on the terminal. Eligibility, not a promise. */
export const TIERS = [
  { name: "OBSERVER", min: 0 },
  { name: "SIGNAL", min: 1_000 },
  { name: "AMPLIFIER", min: 5_000 },
  { name: "OPERATOR", min: 25_000 },
  { name: "INSIDER", min: 100_000 },
] as const;

export function tierFor(lifetimePoints: number): string {
  let tier = TIERS[0].name as string;
  for (const t of TIERS) if (lifetimePoints >= t.min) tier = t.name;
  return tier;
}

// ── Epochs & rewards ─────────────────────────────────────────────────────

export interface Epoch {
  id: number;
  startsAt: string;
  endsAt: string;
  status: "open" | "paid";
  rewardsPoolLamports: string;
}

export interface EpochPayout {
  epochId: number;
  wallet: string;
  points: number;
  amountLamports: string;
  txSignature: string | null;
  status: "sent" | "failed";
}

// ── Ads ──────────────────────────────────────────────────────────────────

export type AdStatus = "pending_payment" | "active" | "expired" | "rejected";

export interface Ad {
  id: number;
  wallet: string;
  headline: string;
  url: string;
  days: number;
  priceLamports: string;
  status: AdStatus;
  bookingCode: string;
  paymentSignature: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

// ── API responses ────────────────────────────────────────────────────────

export interface OverviewResponse {
  ticker: string;
  mint: string;
  treasury: string;
  totals: {
    feesClaimedLamports: string;
    buybackSpentLamports: string;
    rewardsPaidLamports: string;
    adRevenueLamports: string;
    devPaidLamports: string;
  };
  pools: {
    /** Treasury lamports earmarked for buybacks. */
    buybackPoolLamports: string;
    /** Current epoch's attention-rewards pool. */
    rewardsPoolLamports: string;
  };
  epoch: (Epoch & { msRemaining: number }) | null;
  splits: {
    feeBuybackShare: number;
    revenueBuybackShare: number;
  };
  adPriceLamportsPerDay: string;
  lastScanAt: string | null;
  lastClaimAt: string | null;
}

export interface FeedEvent {
  at: string;
  kind: "claim" | "buyback" | "reward" | "post" | "ad" | "scan";
  text: string;
}

export interface PlayerResponse {
  wallet: string;
  lifetimePoints: number;
  epochPoints: number;
  tier: string;
  rank: number | null;
  posts: SocialPost[];
}

// ── Signed-message formats (must match website byte-for-byte) ────────────

export function submitPostMessage(url: string, wallet: string): string {
  return `ATTENTION MARKETS | submit post | ${url} | wallet ${wallet}`;
}

export function bookAdMessage(headline: string, days: number, wallet: string): string {
  return `ATTENTION MARKETS | book ad | ${days}d | ${headline} | wallet ${wallet}`;
}
