/**
 * Crowdy.fun — the single source of truth.
 *
 * Every address, amount and tunable lives here. Nothing else in the site or the
 * scripts is allowed to hardcode one.
 *
 * SOL amounts are lamports as BigInt, always. There is no float anywhere in this file
 * and there must not be one anywhere near an amount — `formatSol` does its own integer
 * string arithmetic rather than dividing.
 */

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

export const CAMPAIGN_PROGRAM_ID = "8xPvcUYHEiS4tq7NVuVTixfvXnMcLsaLQRLzVNk3eimU";

export const SEEDS = {
  platform: "platform",
  campaign: "campaign",
  vault: "vault",
  contribution: "contribution",
} as const;

// ---------------------------------------------------------------------------
// The gate — you have to be a holder to take part
// ---------------------------------------------------------------------------

/**
 * The token Crowdy gates on. Holding at least GATE_AMOUNT of this lets you post a
 * campaign and back one.
 *
 * STILL UNSET. The site renders a clear "not configured" state rather than pretending,
 * and every script refuses to touch a cluster until it is filled in.
 */
export const GATE_MINT: string | null = process.env.NEXT_PUBLIC_GATE_MINT ?? null;

/** Decimals of the gate token. pump.fun's default is 6. */
export const GATE_DECIMALS = 6;

/** Base units multiplier for the gate token. */
export const GATE_UNIT = 10n ** BigInt(GATE_DECIMALS);

/**
 * How much you must hold to be eligible: 1,000,000 tokens.
 * Base units — 1,000,000 × 10^6.
 */
export const GATE_AMOUNT = 1_000_000n * GATE_UNIT;

// ---------------------------------------------------------------------------
// SOL
// ---------------------------------------------------------------------------

export const LAMPORTS_PER_SOL = 1_000_000_000n;

/** Whole SOL -> lamports. Integer in, integer out. */
export const sol = (whole: number | bigint): bigint =>
  typeof whole === "bigint"
    ? whole * LAMPORTS_PER_SOL
    : BigInt(Math.round(whole * 1e9));

// ---------------------------------------------------------------------------
// Campaign rules — mirrored by the program, which is the real enforcement
// ---------------------------------------------------------------------------

export const MIN_DURATION_SECONDS = 60 * 60; // 1 hour
export const MAX_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const MAX_TITLE = 64;
export const MAX_SUMMARY = 280;
export const MAX_LINK = 128;

/** Platform fee on FUNDED campaigns only. Refunds never take a cut. */
export const FEE_BPS = 200; // 2%
export const MAX_FEE_BPS = 500; // hard ceiling in the program

export const DURATION_PRESETS = [
  { label: "24 hours", seconds: 60 * 60 * 24 },
  { label: "3 days", seconds: 60 * 60 * 24 * 3 },
  { label: "7 days", seconds: 60 * 60 * 24 * 7 },
  { label: "14 days", seconds: 60 * 60 * 24 * 14 },
  { label: "30 days", seconds: 60 * 60 * 24 * 30 },
] as const;

// ---------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------

/**
 * The Helius key is server-side only — no NEXT_PUBLIC_ prefix, so Next.js cannot
 * inline it into the browser bundle. The client talks to our own /api/rpc.
 */
export const RPC_PROXY_PATH = "/api/rpc";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") as
  | "devnet"
  | "mainnet-beta";

export const explorerTx = (sig: string): string =>
  `https://solscan.io/tx/${sig}${CLUSTER === "mainnet-beta" ? "" : "?cluster=devnet"}`;

export const explorerAddr = (addr: string): string =>
  `https://solscan.io/account/${addr}${CLUSTER === "mainnet-beta" ? "" : "?cluster=devnet"}`;

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

export const SITE = {
  name: "Crowdy.fun",
  tagline: "Somebody says let's do this. Holders decide if it happens.",
  description:
    "Holder-gated crowdfunding on Solana. Post an idea, set a goal, set a deadline. " +
    "Hit the goal and the money is released. Miss it and every backer takes their SOL back in full.",
} as const;

export const COLORS = {
  bg: "#0B0B10",
  surface: "#15151E",
  edge: "#252533",
  text: "#ECECF3",
  muted: "#8B8BA3",
  accent: "#7C5CFF",
  success: "#35E08F",
  danger: "#FF5C5C",
  warn: "#FFB84D",
} as const;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export class ConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Refusing to run: ${missing.length} required config value(s) still unset — ` +
        `${missing.join(", ")}. Fill them in config/crowdy.ts (or the matching env var).`,
    );
    this.name = "ConfigError";
  }
}

export function assertDeployReady(): void {
  const missing: string[] = [];
  if (!GATE_MINT) missing.push("GATE_MINT");
  if (missing.length) throw new ConfigError(missing);
}

export const isConfigured = (): boolean => Boolean(GATE_MINT);

// ---------------------------------------------------------------------------
// Formatting — BigInt only
// ---------------------------------------------------------------------------

/** Lamports -> "1.25" style SOL. Trims trailing zeros, never uses Number. */
export function formatSol(lamports: bigint, decimals = 2): string {
  const neg = lamports < 0n;
  const abs = neg ? -lamports : lamports;

  const whole = abs / LAMPORTS_PER_SOL;
  const frac = abs % LAMPORTS_PER_SOL;

  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decimals === 0) return `${neg ? "-" : ""}${grouped}`;

  let fracStr = frac.toString().padStart(9, "0").slice(0, decimals);
  fracStr = fracStr.replace(/0+$/, "");
  return `${neg ? "-" : ""}${grouped}${fracStr ? `.${fracStr}` : ""}`;
}

/** Gate-token base units -> "1,000,000". */
export function formatGate(base: bigint): string {
  return (base / GATE_UNIT).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Percent of goal reached, 0..100, as an integer. Integer maths only — a campaign at
 * 99.9% must not render as 100%, so this floors rather than rounds.
 */
export function pctOfGoal(raised: bigint, goal: bigint): number {
  if (goal <= 0n) return 0;
  const pct = (raised * 100n) / goal;
  return Number(pct > 100n ? 100n : pct);
}

/** "2d 4h left", "14m left", or "ended". */
export function timeLeft(deadlineSeconds: number, nowSeconds = Date.now() / 1000): string {
  const left = Math.floor(deadlineSeconds - nowSeconds);
  if (left <= 0) return "ended";
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}
