import { API_URL } from "./config";

export type Side = "HODL" | "NOHODL";

export interface SideTotals {
  players: number;
  weight: string;
}

export interface RoundSummary {
  roundNumber: number;
  winningSide: Side | null;
  decisionBlockhash: string | null;
  potLamports: string;
  settledAt: string | null;
  winnersPaid: number;
  paidLamports: string;
}

export interface GameState {
  mint: string;
  tokenDecimals: number;
  minHoldTokens: number;
  potLamports: string;
  round: { roundNumber: number; locksAt: string; settlesAt: string } | null;
  totals: Record<Side, SideTotals>;
  lastRound: RoundSummary | null;
}

export interface LeaderboardEntry {
  wallet: string;
  totalWonLamports: string;
  wins: number;
}

export interface History {
  rounds: RoundSummary[];
  leaderboard: LeaderboardEntry[];
  totalClaimedLamports: string;
  totalPaidLamports: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const fetchGameState = () => getJson<GameState>("/api/state");
export const fetchHistory = () => getJson<History>("/api/history");

export const fetchMyPick = async (roundNumber: number, wallet: string) => {
  const res = await getJson<{ pick: { side: Side; pickedAt: string } | null }>(
    `/api/pick/${roundNumber}/${wallet}`
  );
  return res.pick;
};

export async function submitPick(body: {
  wallet: string;
  side: Side;
  roundNumber: number;
  signature: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${API_URL}/api/pick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error ?? `request failed (${res.status})` };
  return { ok: true };
}

/** Must stay byte-identical to pickMessage() in @hodl/shared. */
export function pickMessage(roundNumber: number, side: Side, wallet: string): string {
  return `HODL OR NO HODL | round ${roundNumber} | pick ${side} | wallet ${wallet}`;
}
