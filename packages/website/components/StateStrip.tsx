"use client";

import { MODE, useBoardState } from "@/lib/data";

const STATE_LABEL: Record<string, string> = {
  PREVIEW: "PREVIEW — no live session yet",
  DEBATE_LIVE: "DEBATE LIVE",
  VOTING_LIVE: "DEBATE & VOTING LIVE",
  EXECUTION_GUARDED: "EXECUTION GUARDED",
  FULLY_ACTIVE: "FULLY ACTIVE",
  PAUSED: "PAUSED",
};

/** The truthfulness strip: launch state + execution banner + demo banner. */
export function StateStrip() {
  const s = useBoardState();
  return (
    <div className="state-strip">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-1.5">
        <span className="flex items-center gap-2 text-brass-400">
          <span className={`h-1.5 w-1.5 rounded-full ${s.launchState === "PAUSED" ? "bg-reject" : MODE === "api" ? "bg-committee-500 animate-pulse" : "bg-brass-500"}`} />
          {STATE_LABEL[s.launchState] ?? s.launchState}
        </span>
        {s.executionBanner && <span className="text-cream-faint">{s.executionBanner}</span>}
        {s.demoBanner && <span className="text-reject">{s.demoBanner}</span>}
      </div>
    </div>
  );
}
