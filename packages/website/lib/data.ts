"use client";

import { useEffect, useRef, useState } from "react";
import {
  AGENTS,
  DEFAULT_POLICY,
  DEMO_BANNER,
  DEMO_MESSAGES,
  DEMO_PROPOSALS,
  DEMO_SESSION,
  DEMO_SNAPSHOT,
  DEMO_VOTES,
  EXECUTION_INACTIVE_BANNER,
  type AgentVote,
  type BoardMessage,
  type LaunchState,
  type Proposal,
  type TreasuryPolicy,
  type TreasurySnapshot,
} from "@board/shared";

/**
 * Data source resolution — the truthfulness switchboard.
 *
 *   demo    NEXT_PUBLIC_DEMO_MODE=true → the labeled, deterministic demo
 *           script from @board/shared, always under the simulation banner.
 *   api     NEXT_PUBLIC_API_URL set → the live engine (REST + SSE).
 *   preview neither → static protocol facts only (agents, policy, docs);
 *           session surfaces truthfully report that nothing is live.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export type Mode = "demo" | "api" | "preview";
export const MODE: Mode = DEMO ? "demo" : API_URL ? "api" : "preview";

export interface BoardState {
  launchState: LaunchState;
  executionBanner: string | null;
  demoBanner: string | null;
  holderVotingActive: boolean;
  policy: TreasuryPolicy;
}

const PREVIEW_STATE: BoardState = {
  launchState: "PREVIEW",
  executionBanner: EXECUTION_INACTIVE_BANNER,
  demoBanner: null,
  holderVotingActive: false,
  policy: DEFAULT_POLICY,
};

const DEMO_STATE: BoardState = {
  ...PREVIEW_STATE,
  demoBanner: DEMO_BANNER,
};

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useBoardState(): BoardState {
  const [state, setState] = useState<BoardState>(MODE === "demo" ? DEMO_STATE : PREVIEW_STATE);
  useEffect(() => {
    if (MODE !== "api") return;
    void getJson<{ launchState: LaunchState; executionBanner: string | null; holderVotingActive: boolean; policy: TreasuryPolicy }>(
      "/api/state"
    ).then((s) => {
      if (s) setState({ ...s, demoBanner: null });
    });
  }, []);
  return state;
}

export interface SessionData {
  sessionNumber: number | null;
  sessionKind: "live" | "demo" | null;
  stage: string | null;
  messages: BoardMessage[];
  proposals: Proposal[];
  votes: AgentVote[];
  connected: boolean;
}

const EMPTY: SessionData = {
  sessionNumber: null,
  sessionKind: null,
  stage: null,
  messages: [],
  proposals: [],
  votes: [],
  connected: false,
};

function rowToProposal(r: any): Proposal {
  return {
    id: r.id,
    sessionId: r.session_id,
    agentId: r.agent_id,
    revision: r.revision,
    title: r.title,
    actionType: r.action_type,
    asset: r.asset,
    recipient: r.recipient,
    amountUsd: Number(r.amount_usd),
    pctOfAvailable: Number(r.pct_of_available),
    maxSlippageBps: r.max_slippage_bps,
    expiresAt: r.expires_at,
    expectedResult: r.expected_result,
    primaryRisk: r.primary_risk,
    supportingData: r.supporting_data,
    status: r.status,
    createdAt: r.created_at,
    policyViolation: r.policy_violation ?? undefined,
  };
}

function rowToVote(r: any): AgentVote {
  return { proposalId: r.proposal_id, agentId: r.agent_id, choice: r.choice, explanation: r.explanation, castAt: r.cast_at };
}

/** Live session data: fixtures in demo, REST + SSE in api, empty in preview. */
export function useSession(): SessionData {
  const [data, setData] = useState<SessionData>(
    MODE === "demo"
      ? {
          sessionNumber: DEMO_SESSION.number,
          sessionKind: "demo",
          stage: DEMO_SESSION.stage,
          messages: DEMO_MESSAGES,
          proposals: DEMO_PROPOSALS,
          votes: DEMO_VOTES,
          connected: true,
        }
      : EMPTY
  );
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (MODE !== "api") return;
    let alive = true;

    void getJson<{ session: any; messages: BoardMessage[]; proposals: any[]; votes: any[] }>("/api/session/current").then((d) => {
      if (!d || !alive) return;
      setData({
        sessionNumber: d.session ? Number(d.session.number) : null,
        sessionKind: d.session?.kind ?? null,
        stage: d.session?.stage ?? null,
        messages: d.messages ?? [],
        proposals: (d.proposals ?? []).map(rowToProposal),
        votes: (d.votes ?? []).map(rowToVote),
        connected: false,
      });
    });

    const es = new EventSource(`${API_URL}/live`); // browser handles reconnect + Last-Event-ID
    esRef.current = es;
    es.onopen = () => alive && setData((s) => ({ ...s, connected: true }));
    es.onerror = () => alive && setData((s) => ({ ...s, connected: false }));
    es.addEventListener("message", (ev) => {
      if (!alive) return;
      try {
        const { message } = JSON.parse((ev as MessageEvent).data);
        setData((s) =>
          s.messages.some((m) => m.id === message.id) ? s : { ...s, messages: [...s.messages, message], stage: message.stage }
        );
      } catch {
        /* ignore malformed frames */
      }
    });
    es.addEventListener("stage", (ev) => {
      try {
        const { stage } = JSON.parse((ev as MessageEvent).data);
        alive && setData((s) => ({ ...s, stage }));
      } catch {}
    });

    return () => {
      alive = false;
      es.close();
    };
  }, []);

  return data;
}

export function useTreasury(): { snapshot: TreasurySnapshot | null; configured: boolean } {
  const [t, setT] = useState<{ snapshot: TreasurySnapshot | null; configured: boolean }>(
    MODE === "demo" ? { snapshot: DEMO_SNAPSHOT, configured: false } : { snapshot: null, configured: false }
  );
  useEffect(() => {
    if (MODE !== "api") return;
    void getJson<{ snapshot: TreasurySnapshot | null; configured: boolean }>("/api/treasury").then((d) => d && setT(d));
  }, []);
  return t;
}

export function useProposals(): Proposal[] {
  const [ps, setPs] = useState<Proposal[]>(MODE === "demo" ? DEMO_PROPOSALS : []);
  useEffect(() => {
    if (MODE !== "api") return;
    void getJson<{ proposals: any[] }>("/api/proposals").then((d) => d && setPs(d.proposals.map(rowToProposal)));
  }, []);
  return ps;
}

export function useVotesFor(proposalIds: string[]): AgentVote[] {
  if (MODE === "demo") return DEMO_VOTES.filter((v) => proposalIds.includes(v.proposalId));
  return []; // api mode: votes arrive with /api/session/current via useSession
}

export function useReceipts(): any[] {
  const [rs, setRs] = useState<any[]>([]);
  useEffect(() => {
    if (MODE !== "api") return;
    void getJson<{ receipts: any[] }>("/api/receipts").then((d) => d && setRs(d.receipts));
  }, []);
  return rs;
}

// ── chat (wallet-signed) ────────────────────────────────────────────────────

export async function sendChat(body: string): Promise<{ ok: boolean; error?: string }> {
  if (MODE !== "api") return { ok: false, error: "Chat is available when the live engine is connected." };
  const eth = (window as any).ethereum;
  if (!eth) return { ok: false, error: "No wallet found — install an EVM wallet to participate." };
  try {
    const [wallet] = await eth.request({ method: "eth_requestAccounts" });
    const nonceRes = await fetch(`${API_URL}/api/auth/nonce`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
    if (!nonceRes.ok) return { ok: false, error: "Could not get a nonce (rate limited?)." };
    const { nonce } = await nonceRes.json();
    const message = `THE BOARDROOM chat v1\nwallet: ${wallet.toLowerCase()}\nnonce: ${nonce}\nmessage: ${body}`;
    const signature = await eth.request({ method: "personal_sign", params: [message, wallet] });
    const res = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet, nonce, signature, body }),
    });
    if (!res.ok) return { ok: false, error: (await res.json()).error ?? "rejected" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "signing cancelled" };
  }
}

export { AGENTS };
