export type Side = "HODL" | "NOHODL";

export type RoundStatus = "open" | "settled";

export interface Round {
  id: number;
  roundNumber: number;
  openedAt: string; // ISO timestamp
  locksAt: string; // picks rejected after this
  settlesAt: string; // when the coin flips
  status: RoundStatus;
  potLamports: string;
  winningSide: Side | null;
  decisionBlockhash: string | null;
  settledAt: string | null;
}

export interface PickRecord {
  roundId: number;
  wallet: string;
  side: Side;
  /** Raw base-unit token balance at the time the pick was accepted. */
  balanceAtPick: string;
  signature: string;
  pickedAt: string;
}

export interface PayoutRecord {
  roundId: number;
  wallet: string;
  side: Side;
  /** Raw base-unit token balance at settlement — the player's weight. */
  weight: string;
  amountLamports: string;
  txSignature: string | null;
  status: "sent" | "failed";
}

export interface SideTotals {
  players: number;
  weight: string; // summed raw token balances
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

/** Everything the website needs to render the live game, in one call. */
export interface GameStateResponse {
  mint: string;
  tokenDecimals: number;
  minHoldTokens: number;
  potLamports: string;
  round: {
    roundNumber: number;
    locksAt: string;
    settlesAt: string;
  } | null;
  totals: Record<Side, SideTotals>;
  lastRound: RoundSummary | null;
}

export interface LeaderboardEntry {
  wallet: string;
  totalWonLamports: string;
  wins: number;
}

export interface HistoryResponse {
  rounds: RoundSummary[];
  leaderboard: LeaderboardEntry[];
  totalClaimedLamports: string;
  totalPaidLamports: string;
}

export interface HolderBalance {
  owner: string;
  tokenAccount: string;
  amount: string; // raw base units, bigint-safe over JSON
}

export interface HarvestResult {
  source: "pumpfun_creator_fee";
  lamportsHarvested: string;
  signature: string;
}

/**
 * The exact message a wallet signs to submit a pick. Must be byte-identical
 * between the website (signer) and the game-worker (verifier).
 */
export function pickMessage(roundNumber: number, side: Side, wallet: string): string {
  return `HODL OR NO HODL | round ${roundNumber} | pick ${side} | wallet ${wallet}`;
}
