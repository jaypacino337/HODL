import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  Ad,
  AttentionRank,
  Epoch,
  EpochPayout,
  PostStatus,
  ScanItem,
  SocialPost,
  SourceStatus,
} from "@attn/shared";

/** Truncate a numeric string to integer lamports (Postgres numeric can carry decimals). */
const int = (v: unknown) => String(v ?? "0").split(".")[0];

/**
 * Thin Supabase wrapper. The engine connects with the service-role key so
 * writes bypass RLS; the tables themselves are world-readable.
 */
export class AttnDb {
  private sb: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.sb = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // ── fee engine ────────────────────────────────────────────────────────

  async insertFeeClaim(source: string, lamports: string, txSignature: string): Promise<void> {
    const { error } = await this.sb.from("fee_claims").insert({ source, lamports, tx_signature: txSignature });
    if (error) throw new Error(`insertFeeClaim: ${error.message}`);
  }

  async lastClaimAt(): Promise<string | null> {
    const { data, error } = await this.sb
      .from("fee_claims")
      .select("claimed_at")
      .order("claimed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`lastClaimAt: ${error.message}`);
    return data?.claimed_at ?? null;
  }

  async insertLedger(pool: "buyback" | "rewards" | "dev", lamports: bigint, reason: string, ref?: string): Promise<void> {
    const { error } = await this.sb
      .from("ledger")
      .insert({ pool, lamports: lamports.toString(), reason, ref: ref ?? null });
    if (error) throw new Error(`insertLedger: ${error.message}`);
  }

  /** Net lamports currently earmarked for a pool (can never go below 0 by construction). */
  async poolBalance(pool: "buyback" | "rewards" | "dev"): Promise<bigint> {
    const { data, error } = await this.sb.from("ledger").select("lamports").eq("pool", pool);
    if (error) throw new Error(`poolBalance: ${error.message}`);
    return (data ?? []).reduce((sum, r) => sum + BigInt(int(r.lamports)), 0n);
  }

  async insertBuyback(row: {
    lamportsSpent: string;
    tokensBought: string | null;
    txSignature: string | null;
    status: "sent" | "failed" | "skipped";
    note?: string;
  }): Promise<void> {
    const { error } = await this.sb.from("buybacks").insert({
      lamports_spent: row.lamportsSpent,
      tokens_bought: row.tokensBought,
      tx_signature: row.txSignature,
      status: row.status,
      note: row.note ?? null,
    });
    if (error) throw new Error(`insertBuyback: ${error.message}`);
  }

  async recentBuybacks(limit = 10) {
    const { data, error } = await this.sb
      .from("buybacks")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`recentBuybacks: ${error.message}`);
    return data ?? [];
  }

  async recentClaims(limit = 10) {
    const { data, error } = await this.sb
      .from("fee_claims")
      .select("*")
      .order("claimed_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`recentClaims: ${error.message}`);
    return data ?? [];
  }

  // ── epochs ────────────────────────────────────────────────────────────

  private static toEpoch(row: any): Epoch {
    return {
      id: Number(row.id),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      rewardsPoolLamports: int(row.rewards_pool_lamports),
    };
  }

  async getOpenEpoch(): Promise<Epoch | null> {
    const { data, error } = await this.sb
      .from("epochs")
      .select("*")
      .eq("status", "open")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`getOpenEpoch: ${error.message}`);
    return data ? AttnDb.toEpoch(data) : null;
  }

  async createEpoch(endsAt: Date): Promise<Epoch> {
    const { data, error } = await this.sb
      .from("epochs")
      .insert({ ends_at: endsAt.toISOString() })
      .select("*")
      .single();
    if (error) throw new Error(`createEpoch: ${error.message}`);
    return AttnDb.toEpoch(data);
  }

  async creditEpochRewards(epochId: number, current: string, lamports: bigint): Promise<void> {
    const next = (BigInt(int(current)) + lamports).toString();
    const { error } = await this.sb.from("epochs").update({ rewards_pool_lamports: next }).eq("id", epochId);
    if (error) throw new Error(`creditEpochRewards: ${error.message}`);
  }

  async markEpochPaid(epochId: number): Promise<void> {
    const { error } = await this.sb.from("epochs").update({ status: "paid" }).eq("id", epochId);
    if (error) throw new Error(`markEpochPaid: ${error.message}`);
  }

  async insertEpochPayouts(payouts: EpochPayout[]): Promise<void> {
    if (payouts.length === 0) return;
    const { error } = await this.sb.from("epoch_payouts").insert(
      payouts.map((p) => ({
        epoch_id: p.epochId,
        wallet: p.wallet,
        points: p.points,
        amount_lamports: p.amountLamports,
        tx_signature: p.txSignature,
        status: p.status,
      }))
    );
    if (error) throw new Error(`insertEpochPayouts: ${error.message}`);
  }

  // ── attention posts ───────────────────────────────────────────────────

  private static toPost(row: any): SocialPost {
    return {
      id: Number(row.id),
      wallet: row.wallet,
      url: row.url,
      status: row.status,
      points: Number(row.points),
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at ?? null,
      note: row.note ?? null,
    };
  }

  async insertPost(wallet: string, url: string, signature: string, epochId: number | null): Promise<SocialPost> {
    const { data, error } = await this.sb
      .from("social_posts")
      .insert({ wallet, url, signature, epoch_id: epochId })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("that post has already been submitted");
      throw new Error(`insertPost: ${error.message}`);
    }
    return AttnDb.toPost(data);
  }

  async reviewPost(id: number, status: PostStatus, points: number, note?: string): Promise<void> {
    const { error } = await this.sb
      .from("social_posts")
      .update({ status, points, note: note ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`reviewPost: ${error.message}`);
  }

  async postsByWallet(wallet: string, limit = 20): Promise<SocialPost[]> {
    const { data, error } = await this.sb
      .from("social_posts")
      .select("*")
      .eq("wallet", wallet)
      .order("submitted_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`postsByWallet: ${error.message}`);
    return (data ?? []).map(AttnDb.toPost);
  }

  async pendingPosts(limit = 50): Promise<SocialPost[]> {
    const { data, error } = await this.sb
      .from("social_posts")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`pendingPosts: ${error.message}`);
    return (data ?? []).map(AttnDb.toPost);
  }

  /** Approved points per wallet within one epoch (for payouts). */
  async epochPoints(epochId: number): Promise<Map<string, number>> {
    const { data, error } = await this.sb
      .from("social_posts")
      .select("wallet, points")
      .eq("epoch_id", epochId)
      .eq("status", "approved");
    if (error) throw new Error(`epochPoints: ${error.message}`);
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      map.set(row.wallet, (map.get(row.wallet) ?? 0) + Number(row.points));
    }
    return map;
  }

  async leaderboard(epochId: number | null, limit = 25): Promise<AttentionRank[]> {
    const { data, error } = await this.sb.from("attention_leaderboard").select("*").limit(limit);
    if (error) throw new Error(`leaderboard: ${error.message}`);
    const epoch = epochId !== null ? await this.epochPoints(epochId) : new Map<string, number>();
    return (data ?? []).map((row) => ({
      wallet: row.wallet,
      lifetimePoints: Number(row.lifetime_points),
      epochPoints: epoch.get(row.wallet) ?? 0,
      approvedPosts: Number(row.approved_posts),
    }));
  }

  // ── ads ───────────────────────────────────────────────────────────────

  private static toAd(row: any): Ad {
    return {
      id: Number(row.id),
      wallet: row.wallet,
      headline: row.headline,
      url: row.url,
      days: Number(row.days),
      priceLamports: int(row.price_lamports),
      status: row.status,
      bookingCode: row.booking_code,
      paymentSignature: row.payment_signature ?? null,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
      createdAt: row.created_at,
    };
  }

  async insertAd(row: {
    wallet: string;
    headline: string;
    url: string;
    days: number;
    priceLamports: string;
    bookingCode: string;
  }): Promise<Ad> {
    const { data, error } = await this.sb
      .from("ads")
      .insert({
        wallet: row.wallet,
        headline: row.headline,
        url: row.url,
        days: row.days,
        price_lamports: row.priceLamports,
        booking_code: row.bookingCode,
      })
      .select("*")
      .single();
    if (error) throw new Error(`insertAd: ${error.message}`);
    return AttnDb.toAd(data);
  }

  async getAd(id: number): Promise<Ad | null> {
    const { data, error } = await this.sb.from("ads").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`getAd: ${error.message}`);
    return data ? AttnDb.toAd(data) : null;
  }

  async adByPaymentSignature(sig: string): Promise<Ad | null> {
    const { data, error } = await this.sb.from("ads").select("*").eq("payment_signature", sig).maybeSingle();
    if (error) throw new Error(`adByPaymentSignature: ${error.message}`);
    return data ? AttnDb.toAd(data) : null;
  }

  async activateAd(id: number, paymentSignature: string, days: number): Promise<void> {
    const now = new Date();
    const ends = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const { error } = await this.sb
      .from("ads")
      .update({
        status: "active",
        payment_signature: paymentSignature,
        starts_at: now.toISOString(),
        ends_at: ends.toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`activateAd: ${error.message}`);
  }

  async setAdStatus(id: number, status: Ad["status"]): Promise<void> {
    const { error } = await this.sb.from("ads").update({ status }).eq("id", id);
    if (error) throw new Error(`setAdStatus: ${error.message}`);
  }

  async activeAds(): Promise<Ad[]> {
    const { data, error } = await this.sb
      .from("ads")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`activeAds: ${error.message}`);
    return (data ?? []).map(AttnDb.toAd);
  }

  // ── scanner ───────────────────────────────────────────────────────────

  async insertScan(items: ScanItem[], sources: SourceStatus[]): Promise<void> {
    const { data, error } = await this.sb
      .from("scans")
      .insert({ sources: sources as any })
      .select("id")
      .single();
    if (error) throw new Error(`insertScan: ${error.message}`);
    if (items.length === 0) return;
    const { error: itemErr } = await this.sb.from("scan_items").insert(
      items.map((i) => ({
        scan_id: data.id,
        rank: i.rank,
        source: i.source,
        symbol: i.symbol,
        name: i.name,
        score: i.score,
        price_usd: i.priceUsd,
        change_24h: i.change24h,
        volume_24h_usd: i.volume24hUsd,
        url: i.url,
      }))
    );
    if (itemErr) throw new Error(`insertScan items: ${itemErr.message}`);
  }

  async latestScan(): Promise<{ ranAt: string; items: ScanItem[]; sources: SourceStatus[] } | null> {
    const { data, error } = await this.sb
      .from("scans")
      .select("id, ran_at, sources")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`latestScan: ${error.message}`);
    if (!data) return null;
    const { data: items, error: itemErr } = await this.sb
      .from("scan_items")
      .select("*")
      .eq("scan_id", data.id)
      .order("rank", { ascending: true });
    if (itemErr) throw new Error(`latestScan items: ${itemErr.message}`);
    return {
      ranAt: data.ran_at,
      sources: (data.sources ?? []) as SourceStatus[],
      items: (items ?? []).map((i) => ({
        rank: Number(i.rank),
        source: i.source,
        symbol: i.symbol,
        name: i.name,
        score: Number(i.score),
        priceUsd: i.price_usd !== null ? Number(i.price_usd) : null,
        change24h: i.change_24h !== null ? Number(i.change_24h) : null,
        volume24hUsd: i.volume_24h_usd !== null ? Number(i.volume_24h_usd) : null,
        url: i.url ?? null,
      })),
    };
  }

  async platformTotals() {
    const { data, error } = await this.sb.from("platform_totals").select("*").single();
    if (error) throw new Error(`platformTotals: ${error.message}`);
    return {
      feesClaimedLamports: int(data.fees_claimed_lamports),
      buybackSpentLamports: int(data.buyback_spent_lamports),
      rewardsPaidLamports: int(data.rewards_paid_lamports),
      adRevenueLamports: int(data.ad_revenue_lamports),
      devPaidLamports: int(data.dev_paid_lamports),
      buybackPoolLamports: int(data.buyback_pool_lamports),
    };
  }
}
