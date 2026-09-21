"use client";

import { GATE_AMOUNT, GATE_MINT, formatGate } from "../../../config/crowdy.ts";
import { useGateBalance } from "../lib/hooks.ts";

/**
 * Shows whether the connected wallet is eligible, and by how much it is short.
 *
 * This is explanatory only — someone can edit it away in devtools and gain nothing,
 * because the binding check is `check_gate` inside the program. Its job is to stop a
 * person filling in a whole campaign form before discovering they can't post it.
 */
export function GateBadge({ compact = false }: { compact?: boolean }) {
  const { balance, loading } = useGateBalance();

  if (!GATE_MINT) {
    return compact ? null : (
      <div className="card p-4 text-sm text-muted">
        No gate token is configured yet, so eligibility can&apos;t be checked.
      </div>
    );
  }
  if (loading || balance === null) {
    return compact ? null : <div className="card p-4 text-sm text-muted">Checking your balance…</div>;
  }

  const eligible = balance >= GATE_AMOUNT;
  const short = eligible ? 0n : GATE_AMOUNT - balance;

  if (compact) {
    return (
      <span
        className={`chip ${eligible ? "border-success/40 text-success" : "border-edge text-muted"}`}
        title={
          eligible
            ? `You hold ${formatGate(balance)} — you're eligible`
            : `You hold ${formatGate(balance)}, need ${formatGate(GATE_AMOUNT)}`
        }
      >
        <span className={`h-1.5 w-1.5 rounded-full ${eligible ? "bg-success" : "bg-muted"}`} />
        {eligible ? "Holder" : "Not eligible"}
      </span>
    );
  }

  return (
    <div className={`card p-4 ${eligible ? "border-success/30" : "border-warn/30"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="label">Eligibility</span>
        <span className={`text-sm font-medium ${eligible ? "text-success" : "text-warn"}`}>
          {eligible ? "You're in" : "Not eligible yet"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        You hold <span className="tnum text-text">{formatGate(balance)}</span>. Crowdy
        needs <span className="tnum text-text">{formatGate(GATE_AMOUNT)}</span> to post
        or back a campaign.
        {!eligible ? (
          <>
            {" "}
            You&apos;re <span className="tnum text-warn">{formatGate(short)}</span> short.
          </>
        ) : null}
      </p>
    </div>
  );
}
