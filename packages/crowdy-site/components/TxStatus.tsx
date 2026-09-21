"use client";

import { useState } from "react";
import { explorerTx } from "../../../config/crowdy.ts";
import type { TxState } from "../lib/hooks.ts";

const STEP: Record<TxState["kind"], string> = {
  idle: "",
  simulating: "Checking this will work…",
  signing: "Waiting for your wallet…",
  confirming: "Confirming on chain…",
  done: "Done.",
  error: "",
};

export function TxStatus({ state, onReset }: { state: TxState; onReset: () => void }) {
  const [showLogs, setShowLogs] = useState(false);
  if (state.kind === "idle") return null;

  if (state.kind === "error") {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
        {/* The program's own message, never "transaction failed". */}
        <p className="text-sm text-text">{state.error.message}</p>
        {state.error.logs.length > 0 ? (
          <>
            <button
              className="mt-2 text-xs text-muted underline underline-offset-2"
              onClick={() => setShowLogs((v) => !v)}
            >
              {showLogs ? "Hide" : "Show"} program logs
            </button>
            {showLogs ? (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-bg p-3 text-[11px] leading-tight text-muted">
                {state.error.logs.join("\n")}
              </pre>
            ) : null}
          </>
        ) : null}
        <button className="btn mt-3 py-2 text-xs" onClick={onReset}>
          Dismiss
        </button>
      </div>
    );
  }

  if (state.kind === "done") {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-4">
        <p className="text-sm font-medium text-success">Confirmed</p>
        <a
          className="mt-1 block break-all text-xs text-muted underline underline-offset-2"
          href={explorerTx(state.signature)}
          target="_blank"
          rel="noreferrer"
        >
          {state.signature}
        </a>
        <button className="btn mt-3 py-2 text-xs" onClick={onReset}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-edge bg-raised p-4 text-sm text-muted">
      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
      {STEP[state.kind]}
    </div>
  );
}
