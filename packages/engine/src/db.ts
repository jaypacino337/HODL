import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentVote,
  BoardMessage,
  BoardSession,
  ExecutionIntent,
  Proposal,
  Receipt,
  TreasurySnapshot,
} from "@board/shared";

/**
 * Supabase persistence. Service-role key, server-side only — the tables are
 * world-readable via RLS but only this process writes (see
 * supabase/migrations/0001_init.sql). Everything the spec requires persisted
 * flows through here: sessions, stages, snapshots, messages, proposals,
 * revisions, votes, holder data, intents, receipts, violations, versions.
 */
export class BoardDb {
  private sb: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.sb = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async ins(table: string, row: Record<string, unknown>): Promise<void> {
    const { error } = await this.sb.from(table).insert(row);
    if (error) throw new Error(`insert ${table}: ${error.message}`);
  }

  // sessions
  async createSession(s: BoardSession): Promise<void> {
    await this.ins("sessions", {
      id: s.id,
      number: s.number,
      stage: s.stage,
      stage_started_at: s.stageStartedAt,
      started_at: s.startedAt,
      snapshot_id: s.snapshotId,
      kind: s.kind,
      model_id: s.modelId,
      prompt_version_hash: s.promptVersionHash,
    });
  }

  async setStage(sessionId: string, stage: string): Promise<void> {
    const { error } = await this.sb
      .from("sessions")
      .update({ stage, stage_started_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) throw new Error(`setStage: ${error.message}`);
  }

  async lastSessionNumber(): Promise<number> {
    const { data, error } = await this.sb
      .from("sessions")
      .select("number")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`lastSessionNumber: ${error.message}`);
    return data ? Number(data.number) : 0;
  }

  async currentSession(): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.sb
      .from("sessions")
      .select("*")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`currentSession: ${error.message}`);
    return data ?? null;
  }

  async saveSnapshot(s: TreasurySnapshot): Promise<void> {
    await this.ins("treasury_snapshots", {
      id: s.id,
      taken_at: s.takenAt,
      chain_id: s.chainId,
      treasury_address: s.treasuryAddress,
      balances: s.balances,
      total_usd: s.totalUsd,
      available_usd: s.availableUsd,
      reserved_liabilities_usd: s.reservedLiabilitiesUsd,
      recent_revenue_usd: s.recentRevenueUsd,
      previous_allocations: s.previousAllocations,
      policy_version: s.policyVersion,
      verified: s.verified,
    });
  }

  // messages
  async saveMessage(m: BoardMessage): Promise<void> {
    await this.ins("messages", {
      id: m.id,
      session_id: m.sessionId,
      seq: m.seq,
      stage: m.stage,
      kind: m.kind,
      agent_id: m.agentId,
      user_wallet: m.userWallet,
      ref_proposal_id: m.refProposalId,
      body: m.body,
      at: m.at,
    });
  }

  async messagesSince(sessionId: string, afterSeq: number): Promise<BoardMessage[]> {
    const { data, error } = await this.sb
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .gt("seq", afterSeq)
      .order("seq", { ascending: true })
      .limit(500);
    if (error) throw new Error(`messagesSince: ${error.message}`);
    return (data ?? []).map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      seq: Number(r.seq),
      stage: r.stage,
      kind: r.kind,
      agentId: r.agent_id,
      userWallet: r.user_wallet,
      refProposalId: r.ref_proposal_id,
      body: r.body,
      at: r.at,
    }));
  }

  // proposals
  async saveProposal(p: Proposal): Promise<void> {
    const { error } = await this.sb.from("proposals").upsert({
      id: p.id,
      session_id: p.sessionId,
      agent_id: p.agentId,
      revision: p.revision,
      title: p.title,
      action_type: p.actionType,
      asset: p.asset,
      recipient: p.recipient,
      amount_usd: p.amountUsd,
      pct_of_available: p.pctOfAvailable,
      max_slippage_bps: p.maxSlippageBps,
      expires_at: p.expiresAt,
      expected_result: p.expectedResult,
      primary_risk: p.primaryRisk,
      supporting_data: p.supportingData,
      status: p.status,
      created_at: p.createdAt,
      policy_violation: p.policyViolation ?? null,
    });
    if (error) throw new Error(`saveProposal: ${error.message}`);
  }

  async savePolicyViolation(sessionId: string, proposalId: string, agentId: string, rule: string, ruleText: string): Promise<void> {
    await this.ins("policy_violations", {
      session_id: sessionId,
      proposal_id: proposalId,
      agent_id: agentId,
      rule,
      rule_text: ruleText,
    });
  }

  // votes
  async saveVote(v: AgentVote): Promise<void> {
    // duplicate prevention: PK (proposal_id, agent_id) — second vote errors
    const { error } = await this.sb.from("agent_votes").insert({
      proposal_id: v.proposalId,
      agent_id: v.agentId,
      choice: v.choice,
      explanation: v.explanation,
      cast_at: v.castAt,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(`saveVote: ${error.message}`);
  }

  // execution
  async saveIntent(i: ExecutionIntent): Promise<void> {
    const { error } = await this.sb.from("execution_intents").upsert({
      id: i.id,
      proposal_id: i.proposalId,
      idempotency_key: i.idempotencyKey,
      action_type: i.actionType,
      asset: i.asset,
      recipient: i.recipient,
      amount_usd: i.amountUsd,
      max_slippage_bps: i.maxSlippageBps,
      expires_at: i.expiresAt,
      simulated: i.simulated,
      status: i.status,
    });
    if (error) throw new Error(`saveIntent: ${error.message}`);
  }

  async saveReceipt(r: Receipt): Promise<void> {
    const { error } = await this.sb.from("receipts").upsert({
      proposal_id: r.proposalId,
      tx_hash: r.txHash,
      chain_id: r.chainId,
      block_number: r.blockNumber,
      ts: r.timestamp,
      asset: r.asset,
      amount_usd: r.amountUsd,
      recipient: r.recipient,
      agent_votes: r.agentVotes,
      holder_tally: r.holderTally,
      final_status: r.finalStatus,
    });
    if (error) throw new Error(`saveReceipt: ${error.message}`);
  }

  // chat + audit
  async saveAudit(kind: string, detail: Record<string, unknown>): Promise<void> {
    await this.ins("audit_log", { kind, detail });
  }

  async select(table: string, opts: { eq?: [string, unknown]; order?: string; limit?: number } = {}): Promise<any[]> {
    let q = this.sb.from(table).select("*");
    if (opts.eq) q = q.eq(opts.eq[0], opts.eq[1] as never);
    if (opts.order) q = q.order(opts.order, { ascending: false });
    q = q.limit(opts.limit ?? 100);
    const { data, error } = await q;
    if (error) throw new Error(`select ${table}: ${error.message}`);
    return data ?? [];
  }
}
