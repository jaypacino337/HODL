"use client";

import { useState } from "react";
import type { TxState } from "../lib/useMint";

const STEPS: Record<TxState["kind"], string> = {
  idle: "",
  building: "Building transaction…",
  simulating: "Simulating — checking this will actually work…",
  signing: "Waiting for you to approve in your wallet…",
  confirming: "Confirming on chain…",
  done: "Done.",
  error: "",
};

export function TxStatus({
  state,
  onReset,
  explorerBase,
}: {
  state: TxState;
  onReset: () => void;
  explorerBase: string;
}) {
  const [showLogs, setShowLogs] = useState(false);
  if (state.kind === "idle") return null;

  if (state.kind === "error") {
    return (
      <div className="border-2 border-down bg-ink p-3">
        <div className="text-xs font-bold text-down">
          {state.error.code ? `ERROR ${state.error.code}` : "FAILED"}
        </div>
        {/* The real message from the program, never "transaction failed". */}
        <p className="mt-1 text-sm text-bone">{state.error.message}</p>

        {state.error.logs.length > 0 ? (
          <>
            <button
              className="mt-2 text-[10px] uppercase tracking-widest text-mute underline"
              onClick={() => setShowLogs((v) => !v)}
            >
              {showLogs ? "Hide" : "Show"} program logs
            </button>
            {showLogs ? (
              <pre className="mt-2 max-h-48 overflow-auto border-2 border-edge bg-slab p-2 text-[10px] leading-tight text-mute">
                {state.error.logs.join("\n")}
              </pre>
            ) : null}
          </>
        ) : null}

        <button className="btn mt-3 text-xs" onClick={onReset}>
          DISMISS
        </button>
      </div>
    );
  }

  if (state.kind === "done") {
    return (
      <div className="border-2 border-neon bg-ink p-3">
        <div className="text-xs font-bold text-neon">CONFIRMED</div>
        <a
          className="mt-1 block break-all text-xs underline"
          href={`${explorerBase.includes("?") ? explorerBase.replace("/?", `/tx/${state.signature}?`) : `${explorerBase}/tx/${state.signature}`}`}
          target="_blank"
          rel="noreferrer"
        >
          {state.signature}
        </a>
        <button className="btn mt-3 text-xs" onClick={onReset}>
          MINT ANOTHER
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-edge bg-ink p-3 text-xs text-mute">
      <span className="mr-2 inline-block h-2 w-2 animate-blink bg-neon align-middle" />
      {STEPS[state.kind]}
    </div>
  );
}
