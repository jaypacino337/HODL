import { loadConfig, deriveLaunchState } from "./config";
import { BoardDb } from "./db";
import { Orchestrator } from "./orchestrator";
import { buildApi } from "./api";

/**
 * THE BOARDROOM engine (deploy to Railway).
 *
 * Boots into whatever launch state the configuration honestly supports:
 *   PREVIEW           — no model key or DB: read-only API, no sessions
 *   VOTING_LIVE       — sessions + votes on the record, no execution
 *   EXECUTION_GUARDED — + keeper wired to the on-chain TreasuryExecutor
 *   FULLY_ACTIVE      — + holder snapshot system
 *   PAUSED            — emergency stop
 */

const cfg = loadConfig();
const db = cfg.supabaseUrl && cfg.supabaseServiceKey ? new BoardDb(cfg.supabaseUrl, cfg.supabaseServiceKey) : null;
const state = deriveLaunchState(cfg);
const orch = db && cfg.anthropicKeyPresent ? new Orchestrator(cfg, db) : null;

const app = buildApi(cfg, db, orch);
app.listen(cfg.port, () => {
  console.log(`[boardroom] api on :${cfg.port} — launch state: ${state}`);
  if (!cfg.anthropicKeyPresent) console.log("[boardroom] no ANTHROPIC_API_KEY — agents offline (PREVIEW)");
  if (!db) console.log("[boardroom] no Supabase config — nothing will persist (PREVIEW)");

  if (orch && !cfg.paused) {
    console.log(`[boardroom] sessions every ${cfg.sessionIntervalMinutes} minutes`);
    setInterval(() => void orch.runSession().catch((e) => console.error("[session]", e)), cfg.sessionIntervalMinutes * 60_000);
  }
});
