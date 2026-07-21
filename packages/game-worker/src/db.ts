import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  LeaderboardEntry,
  PayoutRecord,
  PickRecord,
  Round,
  RoundSummary,
  Side,
} from "@hodl/shared";

/**
 * Thin Supabase wrapper. The worker connects with the service-role key so
 * writes bypass RLS; the tables themselves are world-readable (see
 * supabase/migrations/0001_init.sql).
 */
export class GameDb {
  private sb: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.sb = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private static toRound(row: any): Round {
    return {
      id: Number(row.id),
      roundNumber: Number(row.round_number),
      openedAt: row.opened_at,
      locksAt: row.locks_at,
      settlesAt: row.settles_at,
      status: row.status,
      potLamports: String(row.pot_lamports),
      winningSide: row.winning_side ?? null,
      decisionBlockhash: row.decision_blockhash ?? null,
      settledAt: row.settled_at ?? null,
    };
  }

  async getOpenRound(): Promise<Round | null> {
    const { data, error } = await this.sb
      .from("rounds")
      .select("*")
      .eq("status", "open")
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`getOpenRound: ${error.message}`);
    return data ? GameDb.toRound(data) : null;
  }

  async getLastRoundNumber(): Promise<number> {
    const { data, error } = await this.sb
      .from("rounds")
      .select("round_number")
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`getLastRoundNumber: ${error.message}`);
    return data ? Number(data.round_number) : 0;
  }

  async createRound(roundNumber: number, opensAt: Date, locksAt: Date, settlesAt: Date): Promise<Round> {
    const { data, error } = await this.sb
      .from("rounds")
      .insert({
        round_number: roundNumber,
        opened_at: opensAt.toISOString(),
        locks_at: locksAt.toISOString(),
        settles_at: settlesAt.toISOString(),
        status: "open",
      })
      .select("*")
      .single();
    if (error) throw new Error(`createRound: ${error.message}`);
    return GameDb.toRound(data);
  }

  async settleRound(
    id: number,
    fields: { potLamports: string; winningSide: Side; decisionBlockhash: string }
  ): Promise<void> {
    const { error } = await this.sb
      .from("rounds")
      .update({
        status: "settled",
        pot_lamports: fields.potLamports,
        winning_side: fields.winningSide,
        decision_blockhash: fields.decisionBlockhash,
        settled_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`settleRound: ${error.message}`);
  }

  async upsertPick(pick: Omit<PickRecord, "pickedAt">): Promise<void> {
    const { error } = await this.sb.from("picks").upsert(
      {
        round_id: pick.roundId,
        wallet: pick.wallet,
        side: pick.side,
        balance_at_pick: pick.balanceAtPick,
        signature: pick.signature,
        picked_at: new Date().toISOString(),
      },
      { onConflict: "round_id,wallet" }
    );
    if (error) throw new Error(`upsertPick: ${error.message}`);
  }

  async getPicks(roundId: number): Promise<PickRecord[]> {
    const { data, error } = await this.sb.from("picks").select("*").eq("round_id", roundId);
    if (error) throw new Error(`getPicks: ${error.message}`);
    return (data ?? []).map((row) => ({
      roundId: Number(row.round_id),
      wallet: row.wallet,
      side: row.side,
      balanceAtPick: String(row.balance_at_pick),
      signature: row.signature,
      pickedAt: row.picked_at,
    }));
  }

  async getPick(roundId: number, wallet: string): Promise<PickRecord | null> {
    const { data, error } = await this.sb
      .from("picks")
      .select("*")
      .eq("round_id", roundId)
      .eq("wallet", wallet)
      .maybeSingle();
    if (error) throw new Error(`getPick: ${error.message}`);
    if (!data) return null;
    return {
      roundId: Number(data.round_id),
      wallet: data.wallet,
      side: data.side,
      balanceAtPick: String(data.balance_at_pick),
      signature: data.signature,
      pickedAt: data.picked_at,
    };
  }

  async insertPayouts(payouts: PayoutRecord[]): Promise<void> {
    if (payouts.length === 0) return;
    const { error } = await this.sb.from("payouts").insert(
      payouts.map((p) => ({
        round_id: p.roundId,
        wallet: p.wallet,
        side: p.side,
        weight: p.weight,
        amount_lamports: p.amountLamports,
        tx_signature: p.txSignature,
        status: p.status,
      }))
    );
    if (error) throw new Error(`insertPayouts: ${error.message}`);
  }

  async insertFeeClaim(source: string, lamports: string, txSignature: string): Promise<void> {
    const { error } = await this.sb.from("fee_claims").insert({
      source,
      lamports,
      tx_signature: txSignature,
    });
    if (error) throw new Error(`insertFeeClaim: ${error.message}`);
  }

  async getRoundSummaries(limit = 20): Promise<RoundSummary[]> {
    const { data, error } = await this.sb
      .from("round_summaries")
      .select("*")
      .order("round_number", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`getRoundSummaries: ${error.message}`);
    return (data ?? []).map((row) => ({
      roundNumber: Number(row.round_number),
      winningSide: row.winning_side ?? null,
      decisionBlockhash: row.decision_blockhash ?? null,
      potLamports: String(row.pot_lamports),
      settledAt: row.settled_at ?? null,
      winnersPaid: Number(row.winners_paid),
      paidLamports: String(row.paid_lamports),
    }));
  }

  async getLeaderboard(limit = 25): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.sb.from("leaderboard").select("*").limit(limit);
    if (error) throw new Error(`getLeaderboard: ${error.message}`);
    return (data ?? []).map((row) => ({
      wallet: row.wallet,
      totalWonLamports: String(row.total_won_lamports),
      wins: Number(row.wins),
    }));
  }

  async getGameTotals(): Promise<{ totalClaimedLamports: string; totalPaidLamports: string }> {
    const { data, error } = await this.sb.from("game_totals").select("*").single();
    if (error) throw new Error(`getGameTotals: ${error.message}`);
    return {
      totalClaimedLamports: String(data.total_claimed_lamports),
      totalPaidLamports: String(data.total_paid_lamports),
    };
  }
}
