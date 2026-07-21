"use client";

import { useEffect, useState } from "react";
import { fetchHistory, History } from "@/lib/api";
import { formatSol, shortAddress } from "@/lib/format";

export function HistoryPanels() {
  const [history, setHistory] = useState<History | null>(null);

  useEffect(() => {
    const load = () => fetchHistory().then(setHistory).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="history" className="mx-auto max-w-6xl px-4 pb-20">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* ── recent rounds ── */}
        <div className="panel p-6">
          <h3 className="font-display text-2xl uppercase tracking-wide text-gold-metal">
            Recent flips
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-amber-100/50">
                <tr>
                  <th className="py-2 pr-4">Round</th>
                  <th className="py-2 pr-4">Result</th>
                  <th className="py-2 pr-4">Pot</th>
                  <th className="py-2 pr-4">Winners</th>
                  <th className="py-2">Paid</th>
                </tr>
              </thead>
              <tbody>
                {(history?.rounds ?? []).map((r) => (
                  <tr key={r.roundNumber} className="border-t border-ember-700/20">
                    <td className="py-2.5 pr-4 font-semibold text-amber-50">#{r.roundNumber}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          r.winningSide === "HODL"
                            ? "bg-gold-500/15 text-gold-300"
                            : "bg-ember-700/25 text-ember-400"
                        }`}
                        title={r.decisionBlockhash ? `blockhash: ${r.decisionBlockhash}` : undefined}
                      >
                        {r.winningSide === "HODL" ? "HODL" : "NO HODL"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-amber-100/80">{formatSol(r.potLamports)} SOL</td>
                    <td className="py-2.5 pr-4 text-amber-100/80">{r.winnersPaid}</td>
                    <td className="py-2.5 text-amber-100/80">{formatSol(r.paidLamports)} SOL</td>
                  </tr>
                ))}
                {(!history || history.rounds.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-amber-100/50">
                      No rounds settled yet — the first flip is coming up.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── leaderboard ── */}
        <div className="panel p-6">
          <h3 className="font-display text-2xl uppercase tracking-wide text-gold-metal">
            Biggest winners
          </h3>
          <div className="mt-4">
            {(history?.leaderboard ?? []).slice(0, 10).map((e, i) => (
              <div
                key={e.wallet}
                className="flex items-center justify-between border-t border-ember-700/20 py-2.5 text-sm first:border-t-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-right font-display text-lg text-ember-500">{i + 1}</span>
                  <span className="font-mono text-amber-100/90">{shortAddress(e.wallet, 5)}</span>
                  <span className="text-xs text-amber-100/50">
                    {e.wins} win{e.wins === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="font-bold text-gold-300">{formatSol(e.totalWonLamports)} SOL</span>
              </div>
            ))}
            {(!history || history.leaderboard.length === 0) && (
              <div className="py-6 text-center text-sm text-amber-100/50">
                Nobody's cashed out yet. Be the first name up here.
              </div>
            )}
          </div>
          {history && (
            <div className="mt-4 border-t border-ember-700/20 pt-4 text-center text-xs text-amber-100/60">
              Lifetime: {formatSol(history.totalClaimedLamports)} SOL claimed in fees ·{" "}
              {formatSol(history.totalPaidLamports)} SOL paid to players
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
