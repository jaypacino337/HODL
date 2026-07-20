export interface HolderBalance {
  owner: string;
  tokenAccount: string;
  amount: string; // raw base units, as string (bigint-safe over JSON)
}

export interface SnapshotSummary {
  id: number;
  takenAt: string; // ISO timestamp
  holderCount: number;
  totalEligibleSupply: string;
  rewardsPoolLamports: string;
}

export interface DistributionRecord {
  snapshotId: number;
  owner: string;
  amountLamports: string;
  signature: string | null;
  status: "pending" | "sent" | "failed";
}

export interface HarvestResult {
  source: "pumpfun_creator_fee" | "token2022_transfer_fee";
  lamportsHarvested: string;
  signature: string;
}

export interface StatsResponse {
  mint: string;
  lastSnapshot: SnapshotSummary | null;
  nextSnapshotAt: string | null;
  totalDistributedLamports: string;
  totalHarvestedLamports: string;
  holderCount: number;
}
