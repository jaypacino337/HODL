import { randomUUID } from "node:crypto";
import {
  AGENTS,
  DebateTurnSchema,
  OpeningSchema,
  ProposalDraftSchema,
  RevisionSchema,
  STAGE_LABEL,
  STAGE_LIMITS,
  VoteSchema,
  canTransition,
  needsHolderRatification,
  promptVersionHash,
  tallyAgentVotes,
  validateProposal,
  type AgentVote,
  type BoardMessage,
  type BoardSession,
  type HolderVoteTally,
  type Proposal,
  type ProposalDraftOut,
  type SessionStage,
  type TreasurySnapshot,
} from "@board/shared";
import { policyRef, type EngineConfig } from "./config";
import { runStructured } from "./agents";
import { takeSnapshot } from "./treasury";
import { buildIntent, isOnchainExecutable, maybeExecute } from "./executor";
import { broadcast } from "./bus";
import type { BoardDb } from "./db";

/**
 * The session orchestrator: one bounded pass through the full decision
 * cycle. Fixed stage order, per-stage time and message limits, every
 * artifact persisted and broadcast. Agent failures degrade to silence for
 * that turn — never to unvalidated output.
 */

export class Orchestrator {
  private seq = 0;
  running = false;

  constructor(
    private cfg: EngineConfig,
    private db: BoardDb
  ) {}

  private async say(
    session: BoardSession,
    stage: SessionStage,
    kind: BoardMessage["kind"],
    agentId: BoardMessage["agentId"],
    body: string,
    refProposalId: string | null = null
  ): Promise<void> {
    const m: BoardMessage = {
      id: `m-${randomUUID().slice(0, 8)}`,
      sessionId: session.id,
      seq: ++this.seq,
      stage,
      kind,
      agentId,
      userWallet: null,
      refProposalId,
      body,
      at: new Date().toISOString(),
    };
    await this.db.saveMessage(m);
    broadcast({ type: "message", message: m });
  }

  private async enterStage(session: BoardSession, stage: SessionStage): Promise<void> {
    session.stage = stage;
    await this.db.setStage(session.id, stage);
    broadcast({ type: "stage", sessionId: session.id, stage });
  }

  /** Run an agent turn under the stage's wall-clock budget; null on failure. */
  private async turn<T>(deadlineAt: number, fn: () => Promise<T>): Promise<T | null> {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) return null;
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("stage deadline")), remaining)),
      ]);
    } catch (err) {
      await this.db.saveAudit("agent_turn_failed", { error: String(err) });
      return null;
    }
  }

  private draftToProposal(session: BoardSession, agentId: (typeof AGENTS)[number]["id"], d: ProposalDraftOut, snapshot: TreasurySnapshot): Proposal {
    return {
      id: `p-${randomUUID().slice(0, 8)}`,
      sessionId: session.id,
      agentId,
      revision: 1,
      title: d.title,
      actionType: d.actionType,
      asset: d.asset,
      recipient: d.recipient,
      amountUsd: d.amountUsd,
      pctOfAvailable: snapshot.availableUsd > 0 ? (d.amountUsd / snapshot.availableUsd) * 100 : 0,
      maxSlippageBps: d.maxSlippageBps,
      expiresAt: new Date(Date.now() + d.expiresInHours * 3600_000).toISOString(),
      expectedResult: d.expectedResult,
      primaryRisk: d.primaryRisk,
      supportingData: d.supportingData,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    };
  }

  async runSession(): Promise<void> {
    if (this.running) return;
    const snapshot = await takeSnapshot(this.cfg);
    if (!snapshot) {
      await this.db.saveAudit("session_skipped", { reason: "no verified treasury snapshot (chain not configured)" });
      return;
    }
    this.running = true;
    this.seq = 0;
    const policy = policyRef.current;
    const model = this.cfg.modelId;

    try {
      const number = (await this.db.lastSessionNumber()) + 1;
      const session: BoardSession = {
        id: `session-${number}-${randomUUID().slice(0, 6)}`,
        number,
        stage: "SNAPSHOT",
        stageStartedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        snapshotId: snapshot.id,
        kind: "live",
        modelId: model,
        promptVersionHash: promptVersionHash(),
      };
      await this.db.saveSnapshot(snapshot);
      await this.db.createSession(session);

      // 1 · SNAPSHOT
      await this.say(
        session,
        "SNAPSHOT",
        "system",
        null,
        `Session ${number} called to order. Verified snapshot ${snapshot.id}: total $${snapshot.totalUsd.toLocaleString()} · available $${snapshot.availableUsd.toLocaleString()} · reserve floor $${policy.minPermanentReserveUsd.toLocaleString()}.`
      );

      // 2 · OPENING
      await this.enterStage(session, "OPENING");
      let deadline = Date.now() + STAGE_LIMITS.OPENING.maxSeconds * 1000;
      for (const agent of AGENTS) {
        const out = await this.turn(deadline, () =>
          runStructured(model, agent.id, policy, snapshot, OpeningSchema, "opening", "Publish your opening recommendation for this session: your position in ≤3 sentences, and the one treasury number you are watching.")
        );
        if (out) await this.say(session, "OPENING", "opening", agent.id, `${out.position} Watching: ${out.watching}`);
      }

      // 3 · PROPOSALS (policy-screened before debate)
      await this.enterStage(session, "PROPOSALS");
      deadline = Date.now() + STAGE_LIMITS.PROPOSALS.maxSeconds * 1000;
      const proposals: Proposal[] = [];
      for (const agent of AGENTS) {
        const d = await this.turn(deadline, () =>
          runStructured(model, agent.id, policy, snapshot, ProposalDraftSchema, "proposal", "Submit exactly one structured proposal consistent with your mandate, the policy and the snapshot. RETAIN_RESERVE / CARRY_FORWARD are valid proposals when you believe no spend is right.")
        );
        if (!d) continue;
        const p = this.draftToProposal(session, agent.id, d, snapshot);
        const verdict = validateProposal(policy, snapshot, p);
        if (verdict.ok) {
          p.status = "DEBATING";
          proposals.push(p);
          await this.db.saveProposal(p);
          await this.say(session, "PROPOSALS", "argument", agent.id, `Proposal: ${p.title} — ${p.actionType} ${p.asset} $${p.amountUsd.toLocaleString()} (${p.pctOfAvailable.toFixed(1)}% of available). Expected: ${p.expectedResult}`, p.id);
        } else {
          p.status = "REJECTED";
          p.policyViolation = { rule: verdict.rule!, ruleText: verdict.ruleText! };
          await this.db.saveProposal(p);
          await this.db.savePolicyViolation(session.id, p.id, agent.id, verdict.rule!, verdict.ruleText!);
          await this.say(session, "PROPOSALS", "system", null, `${agent.name}'s proposal REJECTED BY TREASURY POLICY — ${verdict.rule}: ${verdict.ruleText}`, p.id);
        }
      }

      // 4 · DEBATE: cross-examination (one question + one answer per agent)
      await this.enterStage(session, "CROSS_EXAMINATION");
      deadline = Date.now() + STAGE_LIMITS.CROSS_EXAMINATION.maxSeconds * 1000;
      const live = () => proposals.filter((p) => p.status === "DEBATING");
      const transcript = () =>
        live()
          .map((p) => `[${p.agentId.toUpperCase()} proposes] ${p.title}: ${p.actionType} ${p.asset} $${p.amountUsd} — ${p.expectedResult} (risk: ${p.primaryRisk})`)
          .join("\n");
      const pending: Array<{ from: string; to: string; q: string }> = [];
      for (const agent of AGENTS) {
        const out = await this.turn(deadline, () =>
          runStructured(model, agent.id, policy, snapshot, DebateTurnSchema, "debate_turn", `Proposals on the table:\n${transcript()}\n\nAsk ONE pointed cross-examination question of another board member about their proposal or position (kind="question", set targetAgent).`)
        );
        if (out?.kind === "question" && out.targetAgent && out.targetAgent !== agent.id) {
          pending.push({ from: agent.id, to: out.targetAgent, q: out.body });
          await this.say(session, "CROSS_EXAMINATION", "question", agent.id, `${out.targetAgent.toUpperCase()}: ${out.body}`);
        }
      }
      for (const qa of pending) {
        const out = await this.turn(deadline, () =>
          runStructured(model, qa.to as (typeof AGENTS)[number]["id"], policy, snapshot, DebateTurnSchema, "debate_turn", `Proposals on the table:\n${transcript()}\n\n${qa.from.toUpperCase()} cross-examines you: "${qa.q}"\nAnswer directly (kind="answer").`)
        );
        if (out) await this.say(session, "CROSS_EXAMINATION", "answer", qa.to as never, out.body);
      }

      // 5 · REVISION
      await this.enterStage(session, "REVISION");
      deadline = Date.now() + STAGE_LIMITS.REVISION.maxSeconds * 1000;
      for (const p of live()) {
        const out = await this.turn(deadline, () =>
          runStructured(model, p.agentId, policy, snapshot, RevisionSchema, "revision", `Your proposal on the table:\n${p.title}: ${p.actionType} ${p.asset} $${p.amountUsd}, slippage ${p.maxSlippageBps}bps.\nGiven the cross-examination, revise it (revise=true with a full replacement) or stand pat (revise=false).`)
        );
        if (out?.revise && out.proposal) {
          const revised = this.draftToProposal(session, p.agentId, out.proposal, snapshot);
          const verdict = validateProposal(policy, snapshot, revised);
          if (verdict.ok) {
            Object.assign(p, revised, { id: p.id, revision: p.revision + 1, status: "DEBATING" });
            await this.db.saveProposal(p);
            await this.say(session, "REVISION", "argument", p.agentId, `Revised (r${p.revision}): ${p.title} — ${out.note}`, p.id);
          } else {
            await this.say(session, "REVISION", "system", null, `${p.agentId.toUpperCase()}'s revision REJECTED BY TREASURY POLICY — ${verdict.rule}. Original stands.`, p.id);
          }
        }
      }

      // 6 · FINAL STATEMENTS
      await this.enterStage(session, "FINAL_STATEMENTS");
      deadline = Date.now() + STAGE_LIMITS.FINAL_STATEMENTS.maxSeconds * 1000;
      for (const p of live()) {
        const out = await this.turn(deadline, () =>
          runStructured(model, p.agentId, policy, snapshot, DebateTurnSchema, "debate_turn", `Deliver your final statement for "${p.title}" in ≤3 sentences (kind="final").`)
        );
        if (out) await this.say(session, "FINAL_STATEMENTS", "final", p.agentId, out.body, p.id);
      }

      // 7 · VOTE
      await this.enterStage(session, "VOTE");
      deadline = Date.now() + STAGE_LIMITS.VOTE.maxSeconds * 1000;
      for (const p of live()) {
        if (!canTransition(p.status, "VOTING")) continue;
        p.status = "VOTING";
        await this.db.saveProposal(p);
        const votes: AgentVote[] = [];
        for (const agent of AGENTS) {
          const out = await this.turn(deadline, () =>
            runStructured(model, agent.id, policy, snapshot, VoteSchema, "vote", `Vote on "${p.title}" (${p.actionType} ${p.asset} $${p.amountUsd}, r${p.revision}, proposed by ${p.agentId.toUpperCase()}). YES / NO / ABSTAIN with a concise public explanation.`)
          );
          if (!out) continue;
          const v: AgentVote = { proposalId: p.id, agentId: agent.id, choice: out.choice, explanation: out.explanation, castAt: new Date().toISOString() };
          votes.push(v);
          await this.db.saveVote(v);
          await this.say(session, "VOTE", "vote", agent.id, `${out.choice} — ${out.explanation}`, p.id);
        }
        const tally = tallyAgentVotes(policy, p.actionType, votes);
        if (canTransition(p.status, tally.nextStatus)) p.status = tally.nextStatus;
        await this.db.saveProposal(p);
        broadcast({ type: "proposal", proposalId: p.id, status: p.status });
        await this.say(session, "VOTE", "system", null, `"${p.title}": ${tally.yes} YES / ${tally.no} NO / ${tally.abstain} ABSTAIN — threshold ${tally.required}/5 — ${tally.passed ? "PASSED" : "REJECTED"}${p.status === "AWAITING_HOLDER_VOTE" ? " → holder ratification required" : ""}.`, p.id);
      }

      // 8 · HOLDER RATIFICATION (truthful: inactive until the snapshot system is live)
      await this.enterStage(session, "HOLDER_RATIFICATION");
      const needingHolders = proposals.filter((p) => p.status === "AWAITING_HOLDER_VOTE");
      if (needingHolders.length > 0 && !this.cfg.holderSnapshotEnabled) {
        await this.say(session, "HOLDER_RATIFICATION", "system", null, "Holder ratification is required for sensitive actions but the holder snapshot system is not yet active. These proposals remain AWAITING HOLDER VOTE and will not execute.");
      }

      // 9 · EXECUTION (guarded; truthful when not active)
      await this.enterStage(session, "EXECUTION");
      const executable = proposals.filter((p) => p.status === "AWAITING_EXECUTION");
      for (const p of executable) {
        let intent = buildIntent(p);
        await this.db.saveIntent(intent);
        const votes = (await this.db.select("agent_votes", { eq: ["proposal_id", p.id] })).map((r) => ({
          proposalId: r.proposal_id,
          agentId: r.agent_id,
          choice: r.choice,
          explanation: r.explanation,
          castAt: r.cast_at,
        }));
        const holderTally: HolderVoteTally | null = needsHolderRatification(policy, p.actionType)
          ? { proposalId: p.id, snapshotBlock: null, forPower: 0, againstPower: 0, abstainPower: 0, quorumPower: 0, active: false }
          : null;
        const result = await maybeExecute(this.cfg, intent, p, votes, holderTally);
        intent = result.intent;
        await this.db.saveIntent(intent);
        if (result.receipt) {
          p.status = "EXECUTED";
          await this.db.saveProposal(p);
          await this.db.saveReceipt(result.receipt);
          await this.say(session, "EXECUTION", "system", null, `Executed "${p.title}" — tx ${result.receipt.txHash} (block ${result.receipt.blockNumber}).`, p.id);
        } else if (intent.status === "FAILED") {
          p.status = "FAILED";
          await this.db.saveProposal(p);
          await this.say(session, "EXECUTION", "system", null, `Execution FAILED for "${p.title}" — recorded for guarded retry. Funds unchanged.`, p.id);
        } else {
          await this.say(session, "EXECUTION", "system", null, `"${p.title}" is AWAITING EXECUTION. ${isOnchainExecutable(p) ? "BOARD DECISIONS ARE PUBLIC. EXECUTION IS NOT YET ACTIVE." : "This action type settles via the multisig queue."}`, p.id);
        }
      }

      // 10 · RECEIPTS + ADJOURN
      await this.enterStage(session, "RECEIPTS");
      await this.say(session, "RECEIPTS", "system", null, `Session ${number} adjourned. Decisions, votes and receipts are on the permanent record.`);
      await this.enterStage(session, "ADJOURNED");
    } finally {
      this.running = false;
    }
  }
}
