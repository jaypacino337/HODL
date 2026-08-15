"use client";

import { AIRDROP_TICKERS } from "../../../../config";

/**
 * The airdrop RECORD. Read-only.
 *
 * The airdrop tool itself is explicitly not built yet. This page shows the state of
 * the ticker table so it is obvious which mints are verified and which are not — the
 * tool, when it is built, must refuse to run for any ticker whose mint is still unset,
 * and that rule is much easier to trust when the unset ones are visible.
 */
export default function AirdropPage() {
  const rows = Object.entries(AIRDROP_TICKERS);
  const verified = rows.filter(([, v]) => v.verified).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-widest">AIRDROP RECORD</h1>
        <p className="mt-2 max-w-xl text-sm text-mute">
          100 of the 1,000 brokers carry an <span className="text-bone">Airdrop</span>{" "}
          attribute naming a tokenized stock. Holding one at snapshot time is what
          qualifies you.
        </p>
      </header>

      <div className="panel">
        <div className="label mb-2">Ticker mints</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-mute">
                <th className="py-2 pr-4 font-normal">TICKER</th>
                <th className="py-2 pr-4 font-normal">MINT ADDRESS</th>
                <th className="py-2 font-normal">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([ticker, v]) => (
                <tr key={ticker} className="border-t-2 border-edge">
                  <td className="py-2 pr-4 font-bold">{ticker}</td>
                  <td className="break-all py-2 pr-4 text-mute">
                    {v.mint ?? "— not set —"}
                  </td>
                  <td className="py-2">
                    {v.verified ? (
                      <span className="text-neon">VERIFIED</span>
                    ) : (
                      <span className="text-down">UNVERIFIED</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel text-xs leading-relaxed text-mute">
        <span className="text-bone">
          {verified} of {rows.length} ticker mints are verified.
        </span>{" "}
        No airdrop has run. When the airdrop tool is built it will snapshot holders from
        chain, show a table for review, export CSV, and only then send — and it will
        refuse outright to run for any ticker still marked UNVERIFIED above. Sending a
        million dollars of the wrong token because a mint address was guessed is not a
        recoverable mistake.
      </div>
    </div>
  );
}
