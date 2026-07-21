"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import {
  fetchGameState,
  fetchHistory,
  fetchPlayerStats,
  GameState,
  History,
  pickMessage,
  PlayerStats,
  Side,
  submitPick,
} from "@/lib/api";
import { formatCountdown, formatSol, formatTokens, shortAddress } from "@/lib/format";

const STATE_POLL_MS = 8_000;
const HISTORY_POLL_MS = 30_000;
const SETTLE_POLL_MS = 3_000;

type Phase = "STANDBY" | "FILLING" | "DECISION" | "LOCKED" | "SETTLING";

interface FeedEvent {
  at: number;
  html: { icon: string; text: React.ReactNode };
}

function tierFor(balanceTokens: number): { name: string; hot: boolean } {
  if (balanceTokens >= 10_000_000) return { name: "Obsidian Hands", hot: true };
  if (balanceTokens >= 3_000_000) return { name: "Diamond Hands", hot: true };
  if (balanceTokens >= 1_000_000) return { name: "Iron Hands", hot: false };
  return { name: "Paper Hands", hot: false };
}

function ep(n: number): string {
  return `EP ${String(n).padStart(3, "0")}`;
}

export function StageGame() {
  const { connection } = useConnection();
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [state, setState] = useState<GameState | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [player, setPlayer] = useState<PlayerStats | null>(null);
  const [balanceRaw, setBalanceRaw] = useState<bigint | null>(null);
  const [myPick, setMyPick] = useState<Side | null>(null);
  const [submitting, setSubmitting] = useState<Side | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ownEvents, setOwnEvents] = useState<FeedEvent[]>([]);
  const [shake, setShake] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Settlement overlay state
  const [settling, setSettling] = useState<{
    episode: number;
    frozenTotals: GameState["totals"];
    prevWonLamports: string | null;
    result: GameState["lastRound"] | null;
    myDelta: string | null;
  } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ── clocks & polling ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshState = useCallback(() => {
    fetchGameState().then(setState).catch(() => {});
  }, []);
  const refreshHistory = useCallback(() => {
    fetchHistory().then(setHistory).catch(() => {});
  }, []);
  const refreshPlayer = useCallback(() => {
    if (!publicKey) return;
    fetchPlayerStats(publicKey.toBase58())
      .then((p) => {
        setPlayer(p);
        setMyPick(p.currentPick);
      })
      .catch(() => {});
  }, [publicKey]);

  useEffect(() => {
    refreshState();
    const t = setInterval(refreshState, STATE_POLL_MS);
    return () => clearInterval(t);
  }, [refreshState]);

  useEffect(() => {
    refreshHistory();
    const t = setInterval(refreshHistory, HISTORY_POLL_MS);
    return () => clearInterval(t);
  }, [refreshHistory]);

  useEffect(() => {
    setPlayer(null);
    setMyPick(null);
    refreshPlayer();
    const t = setInterval(refreshPlayer, HISTORY_POLL_MS);
    return () => clearInterval(t);
  }, [refreshPlayer]);

  // ── wallet token balance ──────────────────────────────────────────────
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

  // ── derived game values ───────────────────────────────────────────────
  const decimals = state?.tokenDecimals ?? 6;
  const minRaw = useMemo(
    () => (state ? BigInt(state.minHoldTokens) * 10n ** BigInt(decimals) : 0n),
    [state, decimals]
  );
  const balanceTokens = balanceRaw !== null ? Number(balanceRaw) / 10 ** decimals : null;
  const eligible = balanceRaw !== null && state !== null && balanceRaw >= minRaw;

  const locksAt = state?.round ? new Date(state.round.locksAt).getTime() : 0;
  const settlesAt = state?.round ? new Date(state.round.settlesAt).getTime() : 0;

  const phase: Phase = !state?.round
    ? "STANDBY"
    : now >= settlesAt
      ? "SETTLING"
      : now >= locksAt
        ? "LOCKED"
        : locksAt - now > 5 * 60 * 1000
          ? "FILLING"
          : "DECISION";

  // Weighted audience signal
  const signal = useMemo(() => {
    const h = BigInt(state?.totals?.HODL?.weight ?? "0");
    const n = BigInt(state?.totals?.NOHODL?.weight ?? "0");
    const total = h + n;
    if (total === 0n) return { h: 50, n: 50, empty: true };
    const hPct = Number((h * 1000n) / total) / 10;
    return { h: hPct, n: Math.round((100 - hPct) * 10) / 10, empty: false };
  }, [state?.totals]);

  // Projected share if my side wins, pro-rata by bag
  const projected = useMemo(() => {
    if (!state || balanceRaw === null || balanceRaw === 0n) return null;
    const side: Side = myPick ?? "HODL";
    const sideWeight = BigInt(state.totals[side]?.weight ?? "0");
    const denom = myPick ? (sideWeight > 0n ? sideWeight : balanceRaw) : sideWeight + balanceRaw;
    if (denom === 0n) return null;
    const pot = BigInt(state.potLamports);
    return ((pot * balanceRaw) / denom).toString();
  }, [state, balanceRaw, myPick]);

  // ── settlement overlay lifecycle ──────────────────────────────────────
  useEffect(() => {
    if (phase === "SETTLING" && state?.round && !settling) {
      setSettling({
        episode: state.round.roundNumber,
        frozenTotals: state.totals,
        prevWonLamports: player?.totalWonLamports ?? null,
        result: null,
        myDelta: null,
      });
    }
  }, [phase, state, settling, player]);

  useEffect(() => {
    if (!settling || settling.result) return;
    const t = setInterval(async () => {
      try {
        const s = await fetchGameState();
        setState(s);
        if (s.lastRound && s.lastRound.roundNumber >= settling.episode) {
          let myDelta: string | null = null;
          if (publicKey && settling.prevWonLamports !== null) {
            try {
              const p = await fetchPlayerStats(publicKey.toBase58());
              setPlayer(p);
              myDelta = (BigInt(p.totalWonLamports) - BigInt(settling.prevWonLamports)).toString();
            } catch {}
          }
          setSettling((cur) => (cur ? { ...cur, result: s.lastRound, myDelta } : cur));
          refreshHistory();
        }
      } catch {}
    }, SETTLE_POLL_MS);
    return () => clearInterval(t);
  }, [settling, publicKey, refreshHistory]);

  const closeSettlement = useCallback(() => {
    setSettling(null);
    setMyPick(null);
    refreshState();
    refreshPlayer();
  }, [refreshState, refreshPlayer]);

  // ── pick flow ─────────────────────────────────────────────────────────
  async function onPick(side: Side) {
    if (!state?.round || phase === "LOCKED" || phase === "SETTLING") return;
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    if (!signMessage) {
      showToast("This wallet can't sign messages — try Phantom or Solflare.");
      return;
    }
    setSubmitting(side);
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
        setShake(true);
        setTimeout(() => setShake(false), 600);
        setOwnEvents((ev) => [
          {
            at: Date.now(),
            html: {
              icon: "🔒",
              text: (
                <>
                  <b>Your choice is in:</b> {side === "HODL" ? "HODL" : "NO HODL"} for {ep(state.round!.roundNumber)}. You
                  can switch until the seal.
                </>
              ),
            },
          },
          ...ev,
        ]);
        showToast(
          side === "HODL" ? "🔒 Locked: HODL. Stand with the holders." : "🔒 Locked: NO HODL. Bold. Very bold."
        );
        refreshState();
      } else {
        showToast(`❌ ${res.error ?? "Pick rejected"}`);
      }
    } catch (err) {
      showToast(`❌ ${(err as Error).message ?? "Signing cancelled"}`);
    } finally {
      setSubmitting(null);
    }
  }

  // ── studio feed (real events) ─────────────────────────────────────────
  const feed = useMemo(() => {
    const items: FeedEvent[] = [...ownEvents];
    for (const c of history?.claims ?? []) {
      items.push({
        at: new Date(c.claimedAt).getTime(),
        html: {
          icon: "💰",
          text: (
            <>
              <b>Creator fees claimed:</b> +{formatSol(c.lamports)} SOL into the box.
            </>
          ),
        },
      });
    }
    for (const r of history?.rounds ?? []) {
      items.push({
        at: r.settledAt ? new Date(r.settledAt).getTime() : 0,
        html:
          r.winnersPaid > 0
            ? {
                icon: "📦",
                text: (
                  <>
                    <b>
                      {ep(r.roundNumber)} settled — {r.winningSide === "HODL" ? "HODL" : "NO HODL"}.
                    </b>{" "}
                    {formatSol(r.paidLamports)} SOL paid to {r.winnersPaid} winner{r.winnersPaid === 1 ? "" : "s"}.
                  </>
                ),
              }
            : {
                icon: "🔁",
                text: (
                  <>
                    <b>{ep(r.roundNumber)}: the box stayed sealed.</b> Nobody on{" "}
                    {r.winningSide === "HODL" ? "HODL" : "NO HODL"} — pot rolls over.
                  </>
                ),
              },
      });
    }
    return items.sort((a, b) => b.at - a.at).slice(0, 25);
  }, [ownEvents, history]);

  // ── render helpers ────────────────────────────────────────────────────
  const timer =
    phase === "STANDBY"
      ? "--:--"
      : phase === "SETTLING"
        ? "00:00"
        : phase === "LOCKED"
          ? formatCountdown(settlesAt - now)
          : formatCountdown(locksAt - now);

  const phaseEyebrow = state?.round
    ? `Episode ${String(state.round.roundNumber).padStart(3, "0")} · ${
        phase === "FILLING" ? "Accumulating" : phase === "DECISION" ? "Decision Window" : phase === "LOCKED" ? "Sealed" : "Settlement"
      }`
    : "Waiting for the studio";

  const phaseLabel =
    phase === "STANDBY"
      ? "The studio is warming up…"
      : phase === "FILLING"
        ? "The box is filling…"
        : phase === "DECISION"
          ? "HODL OR NO HODL — make your choice"
          : phase === "LOCKED"
            ? "Choices sealed — the flip is imminent"
            : "Opening the box…";

  const tier = balanceTokens !== null ? tierFor(balanceTokens) : null;
  const boxOpen = !!settling?.result && settling.result.winnersPaid > 0;
  const rolloverActive = !settling && state?.lastRound?.winnersPaid === 0;

  const resultTitle = settling?.result
    ? settling.result.winnersPaid === 0
      ? "NOBODY WINS. THE POT ROLLS OVER."
      : settling.result.winningSide === (myPick ?? "__none")
        ? "YOUR SIDE HELD. THE BOX OPENS."
        : `THE FLIP LANDS ${settling.result.winningSide === "HODL" ? "HODL" : "NO HODL"}.`
    : "Opening the box…";

  const myDeltaNum = settling?.myDelta ? BigInt(settling.myDelta) : 0n;

  return (
    <div>
      {/* ── phase banner ── */}
      <div
        className={`phase-banner mb-6 flex flex-wrap items-center justify-between gap-3 px-6 py-4 ${
          phase === "DECISION" || phase === "LOCKED" ? "hot" : ""
        }`}
      >
        <div>
          <div className="eyebrow">{phaseEyebrow}</div>
          <div className="anton text-lg">{phaseLabel}</div>
        </div>
        <div className="anton text-3xl">{timer}</div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.35fr_.85fr]">
        {/* ── LEFT: the box + choice ── */}
        <div className="panel relative overflow-hidden px-6 py-9 text-center sm:px-8">
          <div className={`mini-box ${boxOpen ? "open" : ""} ${shake ? "sealed-shake" : ""}`}>
            <div className="box-lid" />
            <div className="box-body" />
            <div className="box-q">{boxOpen ? "💎" : "?"}</div>
          </div>
          <div className="anton gold-text mt-3 text-5xl leading-none">
            {state ? `${formatSol(state.potLamports)} SOL` : "—"}
          </div>
          <div className="pot-sub mt-2 text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-smoked">
            What's in the box · Live creator fees
          </div>
          {rolloverActive && (
            <div className="rollover-tag">
              🔁 Rollover active · pot carried from {ep(state!.lastRound!.roundNumber)}
            </div>
          )}

          {/* audience signal */}
          <div className="mt-7 text-left">
            <div className="eyebrow mb-2">Audience Signal</div>
            <div className="signal-bar">
              <div className="signal-hodl" style={{ width: `${signal.h}%` }} />
              <div className="signal-nohodl" style={{ width: `${signal.n}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-sm font-bold">
              <span className="text-gold-400">
                HODL — {signal.h}% · {state?.totals.HODL.players ?? 0} in
              </span>
              <span className="red-text">
                NO HODL — {signal.n}% · {state?.totals.NOHODL.players ?? 0} in
              </span>
            </div>
            <div className="signal-note">
              {signal.empty
                ? "No picks yet this episode. First mover sets the tone."
                : "Live weighted picks. Big bags move this bar — is the crowd bluffing?"}
            </div>
          </div>

          {/* choice buttons */}
          <div className="mt-7">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                className={`cbtn cbtn-hodl ${myPick === "HODL" ? "picked" : ""}`}
                disabled={phase === "LOCKED" || phase === "SETTLING" || phase === "STANDBY" || submitting !== null}
                onClick={() => onPick("HODL")}
              >
                {submitting === "HODL" ? "Signing…" : "Hodl"}
                <small>Stand with the holders</small>
              </button>
              <button
                className={`cbtn cbtn-nohodl ${myPick === "NOHODL" ? "picked" : ""}`}
                disabled={phase === "LOCKED" || phase === "SETTLING" || phase === "STANDBY" || submitting !== null}
                onClick={() => onPick("NOHODL")}
              >
                {submitting === "NOHODL" ? "Signing…" : "No Hodl"}
                <small>Bet against the crowd</small>
              </button>
            </div>

            {myPick && phase !== "SETTLING" && (
              <div className="sealed-note text-left">
                🔒 <b>Your choice is in: {myPick === "HODL" ? "HODL" : "NO HODL"}.</b> One signed message, zero
                gas. You can switch sides until picks seal {phase === "LOCKED" ? "— sealed now" : "30s before the flip"}.
              </div>
            )}
            {!connected && (
              <div className="mt-4 text-center text-[0.8rem] font-bold uppercase tracking-[0.1em] text-smoked">
                Connect a wallet holding {state ? state.minHoldTokens.toLocaleString() : "1,000,000"}+ tokens to play
              </div>
            )}
            {connected && !eligible && balanceRaw !== null && (
              <div className="mt-4 text-center text-[0.8rem] font-bold uppercase tracking-[0.1em] text-ember-500">
                You need {state?.minHoldTokens.toLocaleString() ?? "1,000,000"}+ tokens — you hold{" "}
                {formatTokens(balanceRaw, decimals)}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: your box + studio feed ── */}
        <div className="flex flex-col gap-6">
          <div className="panel px-6 py-6">
            <div className="eyebrow mb-3">
              Your Box{publicKey ? ` · Contestant ${shortAddress(publicKey.toBase58())}` : ""}
            </div>
            {!connected ? (
              <div className="py-4 text-sm font-semibold text-smoked">
                <button onClick={() => setVisible(true)} className="font-bold text-gold-300 underline">
                  Connect your wallet
                </button>{" "}
                to open your contestant profile.
              </div>
            ) : (
              <>
                <div className="stat-line">
                  <span className="l">Balance</span>
                  <span className="r">{balanceRaw !== null ? formatTokens(balanceRaw, decimals) : "…"}</span>
                </div>
                <div className="stat-line">
                  <span className="l">Tier</span>
                  <span className={`r ${tier?.hot ? "red-text" : ""}`}>{tier?.name ?? "…"}</span>
                </div>
                <div className="stat-line">
                  <span className="l">Play Streak</span>
                  <span className="r">
                    {player ? `${player.playStreak} Round${player.playStreak === 1 ? "" : "s"}` : "…"}
                  </span>
                </div>
                <div className="stat-line">
                  <span className="l">Boxes Won</span>
                  <span className="r">{player?.wins ?? "…"}</span>
                </div>
                <div className="stat-line">
                  <span className="l">Total Won</span>
                  <span className="r gold-text">
                    {player ? `${formatSol(player.totalWonLamports)} SOL` : "…"}
                  </span>
                </div>
                <div className="streak-track">
                  {Array.from({ length: 14 }, (_, i) => (
                    <div key={i} className={`seg ${player && i < Math.min(player.playStreak, 14) ? "on" : ""}`} />
                  ))}
                </div>
                <div className="proj">
                  <div className="eyebrow">
                    Projected share if {myPick ? (myPick === "HODL" ? "HODL" : "NO HODL") : "your side"} wins
                  </div>
                  <div className="anton gold-text mt-1 text-3xl">
                    {projected && eligible ? `${formatSol(projected)} SOL` : "—"}
                  </div>
                  <div className="signal-note text-center">your bag ÷ winning side's bags × the pot</div>
                </div>
              </>
            )}
          </div>

          <div className="panel px-6 py-6">
            <div className="eyebrow">Studio Feed</div>
            <div className="feed mt-2">
              {feed.length === 0 && (
                <div className="py-4 text-sm font-semibold text-smoked">
                  Quiet in the studio… the first fee claim hits the feed the moment it lands.
                </div>
              )}
              {feed.map((item, i) => (
                <div className="feed-item" key={`${item.at}-${i}`}>
                  <span className="t">
                    {new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <p>
                    {item.html.icon} {item.html.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── settlement overlay ── */}
      {settling && (
        <div className="overlay">
          <div className="settle-card">
            <div className="eyebrow">Episode {String(settling.episode).padStart(3, "0")} · Settlement</div>
            <h2 className={`anton mt-2 text-3xl ${settling.result && settling.result.winnersPaid === 0 ? "red-text" : "gold-text"}`}>
              {resultTitle}
            </h2>

            <div className="mt-6 text-left">
              <div className="eyebrow mb-2">Final weighted picks</div>
              <div className="signal-bar" style={{ height: 26 }}>
                <div className="signal-hodl" style={{ width: `${signal.h}%` }} />
                <div className="signal-nohodl" style={{ width: `${signal.n}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-sm font-bold">
                <span className="text-gold-400">HODL — {signal.h}%</span>
                <span className="red-text">NO HODL — {signal.n}%</span>
              </div>
            </div>

            {!settling.result ? (
              <div className="mt-8 text-sm font-semibold text-smoked">
                Fetching the deciding blockhash… the flip is being computed on-chain data, not vibes.
              </div>
            ) : (
              <>
                <div className={`payout-line ${myDeltaNum > 0n ? "gold-text" : settling.result.winnersPaid === 0 ? "red-text" : "gold-text"}`}>
                  {connected
                    ? myDeltaNum > 0n
                      ? `+${formatSol(settling.myDelta!)} SOL`
                      : "+0.000 SOL"
                    : `${formatSol(settling.result.paidLamports)} SOL PAID`}
                </div>
                <div className="text-sm font-semibold text-smoked">
                  {settling.result.winnersPaid === 0 ? (
                    <>The winning side was empty. The whole pot rolls into the next episode's box.</>
                  ) : (
                    <>
                      {formatSol(settling.result.paidLamports)} SOL paid to {settling.result.winnersPaid} winner
                      {settling.result.winnersPaid === 1 ? "" : "s"} on{" "}
                      {settling.result.winningSide === "HODL" ? "HODL" : "NO HODL"}, weighted by their bags.
                    </>
                  )}{" "}
                  Blockhash{" "}
                  <span className="font-mono text-cream/80">
                    {settling.result.decisionBlockhash ? shortAddress(settling.result.decisionBlockhash, 6) : "…"}
                  </span>{" "}
                  decided it — recompute it yourself, we can't cheat.
                </div>
                <div className="mt-7">
                  <button className="btn btn-red" onClick={closeSettlement}>
                    Next Episode ↺
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
