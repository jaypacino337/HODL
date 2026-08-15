"use client";

import { useCallback, useEffect, useState } from "react";
import type { Stats } from "../app/api/stats/route";

/**
 * Polls /api/stats. Everything the counters show comes from one server round trip, so
 * the numbers on a page are always mutually consistent — you never see a mint count
 * from one moment next to a treasury balance from another.
 */
export function useStats(pollMs = 8000) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/stats", { cache: "no-store" });
      if (!r.ok) throw new Error(`stats ${r.status}`);
      setStats((await r.json()) as Stats);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { stats, error, refresh };
}
