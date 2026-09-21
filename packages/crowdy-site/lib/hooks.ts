"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { GATE_MINT } from "../../../config/crowdy.ts";
import { decodeError, type DecodedError } from "./errors.ts";
import { ata } from "./pda.ts";
import type { CampaignRow } from "../app/api/campaigns/route.ts";
import type { PlatformInfo } from "../app/api/platform/route.ts";

export type TxState =
  | { kind: "idle" }
  | { kind: "simulating" }
  | { kind: "signing" }
  | { kind: "confirming"; signature: string }
  | { kind: "done"; signature: string }
  | { kind: "error"; error: DecodedError };

/**
 * Send one instruction with the connected wallet.
 *
 * Every transaction is simulated before the user is asked to sign. A simulation is
 * free and catches "you're not a holder", "campaign ended" and "already refunded"
 * before anyone approves anything — and it carries the program logs, which is where
 * the real message lives.
 */
export function useTx() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [state, setState] = useState<TxState>({ kind: "idle" });

  const reset = useCallback(() => setState({ kind: "idle" }), []);

  const send = useCallback(
    async (build: () => TransactionInstruction) => {
      if (!publicKey) {
        const error = decodeError(new Error("Connect a wallet first."));
        setState({ kind: "error", error });
        return { ok: false as const, error };
      }
      try {
        const tx = new Transaction().add(build());
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        setState({ kind: "simulating" });
        const sim = await connection.simulateTransaction(tx);
        if (sim.value.err) {
          const error = decodeError(
            Object.assign(new Error(JSON.stringify(sim.value.err)), {
              logs: sim.value.logs ?? [],
            }),
          );
          setState({ kind: "error", error });
          return { ok: false as const, error };
        }

        setState({ kind: "signing" });
        const signature = await sendTransaction(tx, connection);

        setState({ kind: "confirming", signature });
        const conf = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed",
        );
        if (conf.value.err) throw new Error(JSON.stringify(conf.value.err));

        setState({ kind: "done", signature });
        return { ok: true as const, signature };
      } catch (e) {
        const error = decodeError(e);
        setState({ kind: "error", error });
        return { ok: false as const, error };
      }
    },
    [connection, publicKey, sendTransaction],
  );

  return { state, send, reset, publicKey };
}

/** Platform config + whether anything is deployed yet. */
export function usePlatform(pollMs = 10_000) {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/platform", { cache: "no-store" });
      setPlatform((await r.json()) as PlatformInfo);
    } catch {
      /* leave the last good value up rather than blanking the page */
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { platform, refresh };
}

export function useCampaigns(opts: { id?: number; mine?: boolean } = {}, pollMs = 10_000) {
  const { publicKey } = useWallet();
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);

  const refresh = useCallback(async () => {
    const qs = new URLSearchParams();
    if (opts.id !== undefined) qs.set("id", String(opts.id));
    if (publicKey) qs.set("backer", publicKey.toBase58());
    try {
      const r = await fetch(`/api/campaigns?${qs}`, { cache: "no-store" });
      const j = (await r.json()) as { campaigns: CampaignRow[] };
      setCampaigns(j.campaigns);
    } catch {
      setCampaigns([]);
    }
  }, [opts.id, publicKey]);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { campaigns, refresh };
}

/**
 * The viewer's gate-token balance.
 *
 * The site uses this only to explain eligibility up front rather than letting someone
 * fill in a whole form and then fail. The binding check is in the program.
 */
export function useGateBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey || !GATE_MINT) return setBalance(null);
    setLoading(true);
    try {
      const account = ata(publicKey, new PublicKey(GATE_MINT));
      const res = await connection.getTokenAccountBalance(account);
      setBalance(BigInt(res.value.amount));
    } catch {
      // No token account at all reads as zero, which is the truthful answer.
      setBalance(0n);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, loading, refresh, gateAccount: publicKey && GATE_MINT ? ata(publicKey, new PublicKey(GATE_MINT)) : null };
}
