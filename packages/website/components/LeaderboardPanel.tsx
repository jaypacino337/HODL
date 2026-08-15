"use client";

import type { Rank } from "@/lib/api";
import { formatPoints, shortAddress } from "@/lib/format";

export function LeaderboardPanel({ ranks }: { ranks: Rank[] }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="fkey">F3</span>Attention Leaders
        </div>
        <div className="label">EPOCH REWARDS PAID PRO-RATA</div>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        <table className="tbl">
          <thead className="sticky top-0 bg-term-panel2">
            <tr>
              <th>#</th>
              <th>OPERATOR</th>
              <th className="text-right">EPOCH</th>
              <th className="text-right">LIFETIME</th>
              <th className="text-right">POSTS</th>
            </tr>
          </thead>
          <tbody>
            {ranks.map((r, i) => (
              <tr key={r.wallet}>
                <td className={`num font-bold ${i < 3 ? "text-amber-hi" : "text-dim"}`}>
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="num text-paper/90">{shortAddress(r.wallet, 5)}</td>
                <td className="num text-right text-cyan">{formatPoints(r.epochPoints)}</td>
                <td className="num text-right font-bold text-amber">{formatPoints(r.lifetimePoints)}</td>
                <td className="num text-right text-dim">{r.approvedPosts}</td>
              </tr>
            ))}
            {ranks.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-dim">
                  NO OPERATORS RANKED YET — the first approved post takes #01.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
