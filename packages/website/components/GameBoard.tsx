"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import {
  fetchGameState,
  fetchMyPick,
  GameState,
  pickMessage,
  Side,
  submitPick,
} from "@/lib/api";
import { formatCountdown, formatSol, formatTokens } from "@/lib/format";

const STATE_POLL_MS = 10_000;

export function GameBoard() {
  const { connection } = useConnection();
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [state, setState] = useState<GameState | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [balanceRaw, setBalanceRaw] = useState<bigint | null>(null);
  const [myPick, setMyPick] = useState<Side | null>(null);
  const [submitting, setSubmitting] = useState<Side | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // ── live clock for the countdown ────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── poll game state ─────────────────────────────────────────────────
  const refreshState = useCallback(async () => {
    try {
      const s = await fetchGameState();
      setState(s);
      setStateError(null);
    } catch {
      setStateError("Can't reach the game server — it may be between rounds. Retrying…");
    }
  }, []);

  useEffect(() => {
    refreshState();
    const t = setInterval(refreshState, STATE_POLL_MS);
    return () => clearInterval(t);
  }, [refreshState]);

  // ── the connected wallet's token balance ────────────────────────────
  useEffect(() => {
    if (!publicKey || !state?.mint) {
      setBalanceRaw(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: new PublicKey(state.mint),
        });
        const total = res.value.reduce(
          (sum, { account }) => sum + BigInt(account.data.parsed.info.tokenAmount.amount ?? "0"),
          0n
        );
        if (!cancelled) setBalanceRaw(total);
      } catch {
        if (!cancelled) setBalanceRaw(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey, state?.mint, connection]);

  // ── my current pick for this round ──────────────────────────────────
  useEffect(() => {
    if (!publicKey || !state?.round) {
      setMyPick(null);
      return;
    }
    let cancelled = false;
    fetchMyPick(state.round.roundNumber, publicKey.toBase58())
      .then((p) => !cancelled && setMyPick(p?.side ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [publicKey, state?.round?.roundNumber, state?.round]);

  const decimals = state?.tokenDecimals ?? 6;
  const minRaw = useMemo(
    () => (state ? BigInt(state.minHoldTokens) * 10n ** BigInt(decimals) : 0n),
    [state, decimals]
  );
  const eligible = balanceRaw !== null && state !== null && balanceRaw >= minRaw;
  const progressPct =
    balanceRaw !== null && minRaw > 0n
      ? Math.min(100, Number((balanceRaw * 100n) / minRaw))
      : 0;

  const locksIn = state?.round ? new Date(state.round.locksAt).getTime() - now : 0;
  const settlesIn = state?.round ? new Date(state.round.settlesAt).getTime() - now : 0;
  const locked = locksIn <= 0;

  async function onPick(side: Side) {
    if (!state?.round) return;
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    if (!signMessage) {
      setMessage({ kind: "err", text: "This wallet can't sign messages — try Phantom or Solflare." });
      return;
    }
    setSubmitting(side);
    setMessage(null);
    try {
      const wallet = publicKey.toBase58();
      const msg = new TextEncoder().encode(pickMessage(state.round.roundNumber, side, wallet));
      const sig = await signMessage(msg);
      const res = await submitPick({
        wallet,
        side,
        roundNumber: state.round.roundNumber,
        signature: bs58.encode(sig),
      });
      if (res.ok) {
        setMyPick(side);
        setMessage({
          kind: "ok",
          text: `Locked in: ${side === "HODL" ? "HODL" : "NO HODL"} for round #${state.round.roundNumber}. Good luck!`,
        });
        refreshState();
      } else {
        setMessage({ kind: "err", text: res.error ?? "Pick rejected" });
      }
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message ?? "Signing cancelled" });
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="panel px-6 py-8 sm:px-10">
      {/* ── pot + countdown ── */}
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-ember-400">
            Current pot
          </div>
          <div className="font-display text-5xl text-gold-metal">
            {state ? `${formatSol(state.potLamports)} SOL` : "—"}
          </div>
          <div className="mt-1 text-xs text-amber-100/60">
            funded by creator fees, claimed every 15 minutes
          </div>
        </div>
        <div className="text-center sm:text-right">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-ember-400">
            {state?.round ? (locked ? "Flips in" : "Picks lock in") : "Round"}
          </div>
          <div
            className={`font-display text-5xl ${locked ? "text-ember-400 animate-shimmer" : "text-amber-50"}`}
          >
            {state?.round ? formatCountdown(locked ? settlesIn : locksIn) : "starting…"}
          </div>
          <div className="mt-1 text-xs text-amber-100/60">
            {state?.round ? `round #${state.round.roundNumber}` : "waiting for the game server"}
          </div>
        </div>
      </div>

      {stateError && (
        <div className="mt-4 rounded-lg border border-ember-700/50 bg-ember-700/10 px-4 py-2 text-center text-sm text-ember-400">
          {stateError}
        </div>
      )}

      {/* ── the two cases ── */}
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {(["HODL", "NOHODL"] as Side[]).map((side) => {
          const totals = state?.totals?.[side];
          return (
            <button
              key={side}
              onClick={() => onPick(side)}
              disabled={!state?.round || locked || submitting !== null}
              className={`btn-case ${side === "HODL" ? "btn-hodl" : "btn-nohodl"} ${
                myPick === side ? "ring-picked" : ""
              }`}
            >
              <span>{side === "HODL" ? "HODL" : "NO HODL"}</span>
              <span className="text-sm font-body normal-case tracking-normal opacity-80">
                {submitting === side
                  ? "signing…"
                  : totals
                    ? `${totals.players} player${totals.players === 1 ? "" : "s"} · ${formatTokens(
                        totals.weight,
                        decimals
                      )} weight`
                    : ""}
              </span>
              {myPick === side && (
                <span className="absolute -top-3 rounded-full bg-stage-950 px-3 py-0.5 text-xs font-bold text-gold-300">
                  YOUR PICK
                </span>
              )}
            </button>
          );
        })}
      </div>

      {message && (
        <div
          className={`mt-6 rounded-lg px-4 py-3 text-center text-sm font-semibold ${
            message.kind === "ok"
              ? "border border-gold-500/40 bg-gold-500/10 text-gold-300"
              : "border border-ember-700/50 bg-ember-700/10 text-ember-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ── eligibility ── */}
      <div className="mt-8 rounded-xl border border-ember-700/30 bg-stage-950/60 p-5">
        {!connected ? (
          <div className="text-center text-sm text-amber-100/80">
            <button onClick={() => setVisible(true)} className="font-bold text-gold-300 underline">
              Connect your wallet
            </button>{" "}
            to check if you're holding the {state ? state.minHoldTokens.toLocaleString() : "500,000"}{" "}
            tokens needed to play.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-100/80">
                Your bag:{" "}
                <span className="font-bold text-amber-50">
                  {balanceRaw !== null ? formatTokens(balanceRaw, decimals) : "…"}
                </span>
              </span>
              <span className={eligible ? "font-bold text-gold-300" : "font-bold text-ember-400"}>
                {eligible
                  ? "✓ Eligible — your whole bag is your score"
                  : `Need ${state?.minHoldTokens.toLocaleString() ?? "500,000"}+ to play`}
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-stage-800">
              <div
                className={`h-full rounded-full transition-all ${eligible ? "bg-gold-metal" : "bg-ember-600"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-amber-100/50">
              Bigger bag = bigger share of the pot when your side wins. Balances are re-checked at the
              flip — sell before it and your pick is voided.
            </div>
          </>
        )}
      </div>

      {/* ── last round ── */}
      {state?.lastRound && (
        <div className="mt-6 text-center text-sm text-amber-100/70">
          Last flip: round #{state.lastRound.roundNumber} landed{" "}
          <span
            className={`font-bold ${state.lastRound.winningSide === "HODL" ? "text-gold-300" : "text-ember-400"}`}
          >
            {state.lastRound.winningSide === "HODL" ? "HODL" : "NO HODL"}
          </span>
          {" — "}
          {formatSol(state.lastRound.paidLamports)} SOL paid to {state.lastRound.winnersPaid} winner
          {state.lastRound.winnersPaid === 1 ? "" : "s"}.
        </div>
      )}
    </div>
  );
}
