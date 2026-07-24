import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { MarketDef, Settlement } from "@overbid/shared";

/**
 * Thin Supabase wrapper. The worker connects with the service-role key so
 * writes bypass RLS; the tables are world-readable (see
 * supabase/migrations/0001_init.sql).
 */
export class OracleDb {
  private sb: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.sb = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upsertFeed(id: string, city: string, metric: string, providerRef?: string): Promise<void> {
    const { error } = await this.sb
      .from("index_feeds")
      .upsert({ id, city, metric, provider: "parcl-labs", provider_ref: providerRef ?? null });
    if (error) throw new Error(`upsertFeed: ${error.message}`);
  }

  async upsertObservations(feedId: string, points: Array<{ date: string; value: number }>): Promise<void> {
    if (points.length === 0) return;
    const { error } = await this.sb.from("index_observations").upsert(
      points.map((p) => ({ feed_id: feedId, observed_on: p.date, value: p.value })),
      { onConflict: "feed_id,observed_on" }
    );
    if (error) throw new Error(`upsertObservations: ${error.message}`);
  }

  /** Latest observation on or before `date` (settlement anchor). */
  async observationAtOrBefore(feedId: string, date: string): Promise<{ date: string; value: number } | null> {
    const { data, error } = await this.sb
      .from("index_observations")
      .select("observed_on, value")
      .eq("feed_id", feedId)
      .lte("observed_on", date)
      .order("observed_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`observationAtOrBefore: ${error.message}`);
    return data ? { date: data.observed_on, value: Number(data.value) } : null;
  }

  async feedHistory(feedId: string, limit = 120): Promise<Array<{ date: string; value: number }>> {
    const { data, error } = await this.sb
      .from("index_observations")
      .select("observed_on, value")
      .eq("feed_id", feedId)
      .order("observed_on", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`feedHistory: ${error.message}`);
    return (data ?? []).reverse().map((r) => ({ date: r.observed_on, value: Number(r.value) }));
  }

  async upsertMarket(m: MarketDef): Promise<void> {
    const { error } = await this.sb.from("markets").upsert({
      slug: m.slug,
      question: m.question,
      category: m.category,
      rule: m.rule,
      outcomes: m.outcomes,
      locks_at: m.locksAt,
      settles_at: m.settlesAt,
      status: m.status,
      created_by: m.createdBy,
      seed_liquidity_usd: m.seedLiquidityUsd,
    });
    if (error) throw new Error(`upsertMarket: ${error.message}`);
  }

  async unsettledMarketSlugs(): Promise<string[]> {
    const { data, error } = await this.sb.from("markets").select("slug, status").neq("status", "settled");
    if (error) throw new Error(`unsettledMarketSlugs: ${error.message}`);
    return (data ?? []).map((r) => r.slug as string);
  }

  async recordSettlement(s: Settlement, evidence: unknown): Promise<void> {
    const { error: e1 } = await this.sb.from("settlements").upsert({
      market_slug: s.marketSlug,
      winning_outcome_id: s.winningOutcomeId,
      changes_pct: s.changesPct,
      evidence,
      settled_at: s.settledAt,
    });
    if (e1) throw new Error(`recordSettlement: ${e1.message}`);
    const { error: e2 } = await this.sb.from("markets").update({ status: "settled" }).eq("slug", s.marketSlug);
    if (e2) throw new Error(`recordSettlement status: ${e2.message}`);
  }

  async getSettlements(): Promise<any[]> {
    const { data, error } = await this.sb.from("settlements").select("*");
    if (error) throw new Error(`getSettlements: ${error.message}`);
    return data ?? [];
  }
}
