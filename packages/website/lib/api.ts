import { API_URL } from "./config";

export type ScanSource = "dexscreener" | "coingecko" | "news" | "tiktok";

export interface ScanItem {
  rank: number;
  source: ScanSource;
  symbol: string;
  name: string;
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

export interface Scan {
  ranAt: string | null;
  items: ScanItem[];
  sources: SourceStatus[];
}

export interface Overview {
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
  pools: { buybackPoolLamports: string; rewardsPoolLamports: string };
  epoch: { id: number; endsAt: string; msRemaining: number; rewardsPoolLamports: string } | null;
  splits: { feeBuybackShare: number; revenueBuybackShare: number };
  adPriceLamportsPerDay: string;
  lastScanAt: string | null;
  lastClaimAt: string | null;
}

export interface Rank {
  wallet: string;
  lifetimePoints: number;
  epochPoints: number;
  approvedPosts: number;
}

export interface Post {
  id: number;
  url: string;
  status: "pending" | "approved" | "denied";
  points: number;
  submittedAt: string;
  note: string | null;
}

export interface Player {
  wallet: string;
  lifetimePoints: number;
  epochPoints: number;
  tier: string;
  rank: number | null;
  posts: Post[];
}

export interface FeedEvent {
  at: string;
  kind: string;
  text: string;
}

export interface ActiveAd {
  headline: string;
  url: string;
  endsAt: string | null;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error ?? `request failed (${res.status})` };
  return { ok: true, data: json };
}

export const fetchOverview = () => getJson<Overview>("/api/overview");
export const fetchScan = () => getJson<Scan>("/api/scan");
export const fetchLeaderboard = () => getJson<{ leaderboard: Rank[] }>("/api/leaderboard");
export const fetchPlayer = (wallet: string) => getJson<Player>(`/api/player/${wallet}`);
export const fetchFeed = () => getJson<{ events: FeedEvent[] }>("/api/feed");
export const fetchAds = () =>
  getJson<{ ads: ActiveAd[]; priceLamportsPerDay: string; treasury: string }>("/api/ads");

export const submitPost = (body: { wallet: string; url: string; signature: string }) =>
  postJson<{ id: number; note: string }>("/api/attention/submit", body);

export const bookAd = (body: {
  wallet: string;
  headline: string;
  url: string;
  days: number;
  signature: string;
}) =>
  postJson<{ bookingId: number; bookingCode: string; priceLamports: string; payTo: string; instructions: string }>(
    "/api/ads/book",
    body
  );

export const confirmAd = (body: { bookingId: number; txSignature: string }) =>
  postJson<{ status: string }>("/api/ads/confirm", body);

/** Must stay byte-identical to @attn/shared. */
export const submitPostMessage = (url: string, wallet: string) =>
  `ATTENTION MARKETS | submit post | ${url} | wallet ${wallet}`;
export const bookAdMessage = (headline: string, days: number, wallet: string) =>
  `ATTENTION MARKETS | book ad | ${days}d | ${headline} | wallet ${wallet}`;
