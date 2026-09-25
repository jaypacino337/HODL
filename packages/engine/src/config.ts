import { DEFAULT_POLICY, type LaunchState, type TreasuryPolicy } from "@board/shared";

/**
 * Engine configuration — everything from env, all secrets server-only.
 * The launch state is DERIVED from what is actually configured, so the site
 * can never claim more than the system can do.
 */

export interface EngineConfig {
  port: number;
  corsOrigins: string[];
  adminKey: string | null;
  // AI
  anthropicKeyPresent: boolean;
  modelId: string;
  // storage
  supabaseUrl: string | null;
  supabaseServiceKey: string | null;
  // chain (read-only unless keeper configured)
  rpcUrl: string | null;
  chainId: number;
  treasuryAddress: `0x${string}` | null;
  usdgAddress: `0x${string}` | null;
  boardTokenAddress: `0x${string}` | null;
  boardVaultAddress: `0x${string}` | null;
  executorAddress: `0x${string}` | null;
  keeperKeyPresent: boolean;
  holderSnapshotEnabled: boolean;
  sessionIntervalMinutes: number;
  paused: boolean;
}

const addr = (v: string | undefined): `0x${string}` | null =>
  v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : null;

export function loadConfig(): EngineConfig {
  const e = process.env;
  return {
    port: Number(e.PORT ?? 4000),
    corsOrigins: (e.CORS_ORIGINS ?? "*").split(","),
    adminKey: e.ADMIN_KEY || null,
    anthropicKeyPresent: Boolean(e.ANTHROPIC_API_KEY),
    modelId: e.BOARD_MODEL || "claude-opus-5",
    supabaseUrl: e.SUPABASE_URL || null,
    supabaseServiceKey: e.SUPABASE_SERVICE_ROLE_KEY || null,
    rpcUrl: e.CHAIN_RPC_URL || null,
    chainId: Number(e.CHAIN_ID ?? 421614),
    treasuryAddress: addr(e.TREASURY_ADDRESS),
    usdgAddress: addr(e.USDG_TOKEN_ADDRESS),
    boardTokenAddress: addr(e.BOARD_TOKEN_ADDRESS),
    boardVaultAddress: addr(e.BOARD_VAULT_ADDRESS),
    executorAddress: addr(e.TREASURY_EXECUTOR_ADDRESS),
    keeperKeyPresent: Boolean(e.KEEPER_PRIVATE_KEY),
    holderSnapshotEnabled: e.HOLDER_SNAPSHOT_ENABLED === "true",
    sessionIntervalMinutes: Math.max(60, Number(e.SESSION_INTERVAL_MINUTES ?? 24 * 60)),
    paused: e.ENGINE_PAUSED === "true",
  };
}

/** Truthful launch state, derived — never asserted. */
export function deriveLaunchState(c: EngineConfig): LaunchState {
  if (c.paused) return "PAUSED";
  const canDebate = c.anthropicKeyPresent && c.supabaseUrl && c.supabaseServiceKey;
  if (!canDebate) return "PREVIEW";
  const canExecute = c.executorAddress && c.keeperKeyPresent && c.rpcUrl;
  if (!canExecute) return "VOTING_LIVE"; // debate + recorded votes, execution not active
  return c.holderSnapshotEnabled ? "FULLY_ACTIVE" : "EXECUTION_GUARDED";
}

/** Live policy (admin-editable at runtime; defaults from shared). */
export const policyRef: { current: TreasuryPolicy } = { current: { ...DEFAULT_POLICY } };
