export interface SnapshotSummary {
  id: number;
  takenAt: string;
  holderCount: number;
  totalEligibleSupply: string;
  rewardsPoolLamports: string;
}

export interface StatsResponse {
  mint: string;
  lastSnapshot: SnapshotSummary | null;
  nextSnapshotAt: string | null;
  totalDistributedLamports: string;
  totalHarvestedLamports: string;
  holderCount: number;
}

const API_BASE = process.env.NEXT_PUBLIC_BOT_API_URL ?? "http://localhost:4000";

// Shown until the live bot API is reachable, so the page always looks complete in a fresh checkout / preview deploy.
export const FALLBACK_STATS: StatsResponse = {
  mint: "Not deployed yet",
  lastSnapshot: {
    id: 0,
    takenAt: new Date().toISOString(),
    holderCount: 0,
    totalEligibleSupply: "0",
    rewardsPoolLamports: "0",
  },
  nextSnapshotAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  totalDistributedLamports: "0",
  totalHarvestedLamports: "0",
  holderCount: 0,
};

export async function getStats(): Promise<{ stats: StatsResponse; live: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/stats`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const stats = (await res.json()) as StatsResponse;
    return { stats, live: true };
  } catch {
    return { stats: FALLBACK_STATS, live: false };
  }
}

export function lamportsToSol(lamports: string | number): number {
  return Number(lamports) / 1_000_000_000;
}

export function formatSol(lamports: string | number, digits = 3): string {
  return lamportsToSol(lamports).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
