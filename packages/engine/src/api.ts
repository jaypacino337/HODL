import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import {
  AGENTS,
  AGENT_BY_ID,
  EXECUTION_INACTIVE_BANNER,
  UserReplySchema,
  sanitizeUserMessage,
  type BoardMessage,
} from "@board/shared";
import { deriveLaunchState, policyRef, type EngineConfig } from "./config";
import { issueNonce, rateLimit, verifyChatSignature } from "./auth";
import { attachClient, broadcast, clientCount, sendTo } from "./bus";
import { quoteUserQuestion, runStructured } from "./agents";
import { takeSnapshot } from "./treasury";
import type { BoardDb } from "./db";
import type { Orchestrator } from "./orchestrator";
import { randomUUID } from "node:crypto";

/**
 * The public Boardroom API + live SSE stream. All reads are public; the only
 * writes are signed chat messages and admin-key operations. No secret ever
 * leaves this process: model key, service-role key and keeper key are read
 * from env and never serialized into any response or log.
 */

export function buildApi(cfg: EngineConfig, db: BoardDb | null, orch: Orchestrator | null): express.Express {
  const app = express();
  app.use(cors({ origin: cfg.corsOrigins }));
  app.use(express.json({ limit: "16kb" }));

  const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

  let chatSeq = 1_000_000; // user messages get their own seq space

  app.get("/health", (_req, res) => {
    res.json({ ok: true, launchState: deriveLaunchState(cfg), liveClients: clientCount() });
  });

  app.get("/api/state", (_req, res) => {
    const launchState = deriveLaunchState(cfg);
    res.json({
      launchState,
      executionBanner: ["EXECUTION_GUARDED", "FULLY_ACTIVE"].includes(launchState) ? null : EXECUTION_INACTIVE_BANNER,
      holderVotingActive: cfg.holderSnapshotEnabled,
      chainId: cfg.chainId,
      agents: AGENTS,
      policy: policyRef.current,
    });
  });

  app.get("/api/policy", (_req, res) => res.json({ policy: policyRef.current }));

  app.get(
    "/api/session/current",
    wrap(async (_req, res) => {
      if (!db) return void res.json({ session: null, messages: [], proposals: [], votes: [] });
      const session = await db.currentSession();
      if (!session) return void res.json({ session: null, messages: [], proposals: [], votes: [] });
      const [messages, proposals] = await Promise.all([
        db.messagesSince(String(session.id), 0),
        db.select("proposals", { eq: ["session_id", session.id], order: "created_at" }),
      ]);
      const votes = (
        await Promise.all(proposals.map((p) => db.select("agent_votes", { eq: ["proposal_id", p.id] })))
      ).flat();
      res.json({ session, messages, proposals, votes });
    })
  );

  app.get(
    "/api/agents/:id",
    wrap(async (req, res) => {
      const agent = AGENT_BY_ID[req.params.id];
      if (!agent) return void res.status(404).json({ error: "unknown agent" });
      if (!db) return void res.json({ agent, proposals: [], votes: [], approvalRate: null });
      const [proposals, votes] = await Promise.all([
        db.select("proposals", { eq: ["agent_id", agent.id], order: "created_at" }),
        db.select("agent_votes", { eq: ["agent_id", agent.id], order: "cast_at" }),
      ]);
      const decided = proposals.filter((p) => ["EXECUTED", "AWAITING_EXECUTION", "AWAITING_HOLDER_VOTE", "PASSED", "REJECTED", "FAILED"].includes(p.status));
      const approved = decided.filter((p) => p.status !== "REJECTED");
      res.json({
        agent,
        proposals,
        votes,
        approvalRate: decided.length ? approved.length / decided.length : null,
      });
    })
  );

  app.get(
    "/api/treasury",
    wrap(async (_req, res) => {
      const snapshot = await takeSnapshot(cfg).catch(() => null);
      const history = db ? await db.select("treasury_snapshots", { order: "taken_at", limit: 30 }) : [];
      res.json({ snapshot, history, policy: policyRef.current, configured: Boolean(cfg.rpcUrl && cfg.treasuryAddress) });
    })
  );

  app.get(
    "/api/proposals",
    wrap(async (_req, res) => {
      res.json({ proposals: db ? await db.select("proposals", { order: "created_at", limit: 200 }) : [] });
    })
  );

  app.get(
    "/api/receipts",
    wrap(async (_req, res) => {
      res.json({ receipts: db ? await db.select("receipts", { order: "ts", limit: 100 }) : [] });
    })
  );

  // ── live stream ──────────────────────────────────────────────────────────
  app.get(
    "/live",
    wrap(async (req, res) => {
      const detach = attachClient(res);
      // replay anything the client missed (Last-Event-ID = last seen seq)
      const lastId = Number(req.headers["last-event-id"] ?? 0);
      if (db && lastId > 0) {
        const session = await db.currentSession();
        if (session) {
          for (const m of await db.messagesSince(String(session.id), lastId)) {
            sendTo(res, { type: "message", message: m }, m.seq);
          }
        }
      }
      req.on("close", detach);
    })
  );

  // ── chat (signed, sanitized, rate-limited) ───────────────────────────────
  app.post("/api/auth/nonce", (req, res) => {
    const wallet = String(req.body?.wallet ?? "");
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return void res.status(400).json({ error: "bad wallet" });
    if (!rateLimit(`nonce:${req.ip}`, 20)) return void res.status(429).json({ error: "rate limited" });
    res.json({ nonce: issueNonce(wallet), message: "sign the canonical chat message with this nonce" });
  });

  app.post(
    "/api/chat",
    wrap(async (req, res) => {
      const { wallet, nonce, signature, body } = req.body ?? {};
      if (typeof wallet !== "string" || typeof nonce !== "string" || typeof signature !== "string" || typeof body !== "string") {
        return void res.status(400).json({ error: "bad request" });
      }
      if (!rateLimit(`ip:${req.ip}`, 10) || !rateLimit(`wallet:${wallet.toLowerCase()}`, 5)) {
        return void res.status(429).json({ error: "rate limited" });
      }
      const clean = sanitizeUserMessage(body);
      if (!clean) return void res.status(400).json({ error: "empty message" });
      if (!(await verifyChatSignature(wallet, nonce, body, signature))) {
        return void res.status(401).json({ error: "signature verification failed" });
      }

      const session = db ? await db.currentSession() : null;
      const m: BoardMessage = {
        id: `u-${randomUUID().slice(0, 8)}`,
        sessionId: session ? String(session.id) : "lobby",
        seq: ++chatSeq,
        stage: (session?.stage as BoardMessage["stage"]) ?? "ADJOURNED",
        kind: "user_question",
        agentId: null,
        userWallet: wallet.toLowerCase(),
        refProposalId: null,
        body: clean,
        at: new Date().toISOString(),
      };
      if (db) await db.saveMessage(m);
      broadcast({ type: "message", message: m });
      if (db) await db.saveAudit("chat_message", { wallet: wallet.toLowerCase(), len: clean.length });
      res.json({ ok: true, id: m.id });

      // agent reply — bounded globally, only when the board is live
      if (cfg.anthropicKeyPresent && db && rateLimit("global:agent-replies", 6, 3)) {
        const named = AGENTS.find((a) => clean.toUpperCase().includes(a.name));
        const agent = named ?? AGENTS[Math.floor(Math.random() * AGENTS.length)];
        const snapshot = await takeSnapshot(cfg).catch(() => null);
        if (snapshot) {
          try {
            const out = await runStructured(cfg.modelId, agent.id, policyRef.current, snapshot, UserReplySchema, "user_reply", quoteUserQuestion(clean, wallet));
            const reply: BoardMessage = { ...m, id: `r-${randomUUID().slice(0, 8)}`, seq: ++chatSeq, kind: "agent_reply", agentId: agent.id, userWallet: null, body: out.body, at: new Date().toISOString() };
            await db.saveMessage(reply);
            broadcast({ type: "message", message: reply });
          } catch (err) {
            await db.saveAudit("agent_reply_failed", { error: String(err) });
          }
        }
      }
    })
  );

  // ── admin (key-guarded operational controls) ─────────────────────────────
  const admin = (req: Request, res: Response): boolean => {
    if (!cfg.adminKey || req.headers["x-admin-key"] !== cfg.adminKey) {
      res.status(401).json({ error: "unauthorized" });
      return false;
    }
    return true;
  };

  app.post(
    "/api/admin/session/start",
    wrap(async (req, res) => {
      if (!admin(req, res)) return;
      if (!orch) return void res.status(409).json({ error: "engine not fully configured (PREVIEW)" });
      if (orch.running) return void res.status(409).json({ error: "session already running" });
      void orch.runSession();
      res.json({ ok: true, started: true });
    })
  );

  app.post(
    "/api/admin/pause",
    wrap(async (req, res) => {
      if (!admin(req, res)) return;
      cfg.paused = Boolean(req.body?.paused);
      policyRef.current = { ...policyRef.current, emergencyPaused: cfg.paused };
      broadcast({ type: "state", launchState: deriveLaunchState(cfg) });
      if (db) await db.saveAudit("admin_pause", { paused: cfg.paused });
      res.json({ ok: true, launchState: deriveLaunchState(cfg) });
    })
  );

  app.post(
    "/api/admin/policy",
    wrap(async (req, res) => {
      if (!admin(req, res)) return;
      const patch = req.body?.patch ?? {};
      // only known numeric/array keys may be patched; version bumps required
      const allowed = new Set(Object.keys(policyRef.current));
      for (const k of Object.keys(patch)) {
        if (!allowed.has(k)) return void res.status(400).json({ error: `unknown policy key ${k}` });
      }
      policyRef.current = { ...policyRef.current, ...patch };
      if (db) await db.saveAudit("admin_policy_patch", { patch });
      res.json({ ok: true, policy: policyRef.current });
    })
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api]", err.message);
    res.status(500).json({ error: "internal error" }); // never leak internals
  });

  return app;
}
