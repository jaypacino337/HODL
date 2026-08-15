import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}. See .env.example.`);
  }
  return v;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/**
 * Loads a keypair either from a JSON keypair file path or, if the value
 * itself looks like a JSON array, directly from the env var — Railway has
 * no filesystem secrets, so `TREASURY_KEYPAIR` is usually the raw
 * `[12,34,...]` array pasted into a variable.
 */
function loadKeypair(pathOrJson: string): Keypair {
  const raw = pathOrJson.trim().startsWith("[")
    ? JSON.parse(pathOrJson)
    : JSON.parse(fs.readFileSync(pathOrJson, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export interface AttnConfig {
  rpcUrl: string;
  /** The ecosystem token mint (the pump.fun coin). */
  mint: PublicKey;
  /** Cashtag shown everywhere and required in attention posts, e.g. "$ATTN". */
  ticker: string;
  /**
   * The wallet that created the coin on pump.fun. It claims creator fees
   * (fee vaults are keyed by creator pubkey), holds all pools, executes
   * buybacks, and pays attention rewards. Guard it.
   */
  treasuryKeypair: Keypair;
  /** Receives the development share (10%) of ad/project revenue. */
  devWallet: PublicKey;
  /** How often creator fees are claimed, in ms. Default: 15 minutes. */
  claimIntervalMs: number;
  /** How often the attention scanner runs, in ms. Default: 1 hour. */
  scanIntervalMs: number;
  /** How often accumulated buyback balance is executed, in ms. Default: 4 hours. */
  buybackIntervalMs: number;
  /** Attention-rewards epoch length, in ms. Default: 7 days. */
  epochLengthMs: number;
  /** Share (0-1) of claimed creator fees routed to buybacks. Remainder funds attention rewards. */
  feeBuybackShare: number;
  /** Share (0-1) of ad/project revenue routed to buybacks. Remainder goes to the dev wallet. */
  revenueBuybackShare: number;
  /** SOL (lamports) always left in the treasury for tx fees. */
  treasuryReserveLamports: number;
  /** Price of one ad slot per day, in lamports. */
  adPriceLamportsPerDay: number;
  /** Send bought-back tokens to the burn address instead of holding them. */
  burnBuybacks: boolean;
  /** Shared secret for admin endpoints (reviewing attention posts / ads). */
  adminKey: string;
  /** Optional X (Twitter) API v2 bearer token — enables automatic post verification. */
  xBearerToken: string | null;
  /** Optional newsapi.org key — lights up the news column of the scanner. */
  newsApiKey: string | null;
  pumpFunProgramId: PublicKey;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  apiPort: number;
  /** Comma-separated list of allowed CORS origins for the API ("*" for any). */
  corsOrigins: string;
}

export function loadConfig(): AttnConfig {
  const rpcUrl = optionalEnv("RPC_URL", "https://api.devnet.solana.com");
  const mint = new PublicKey(requireEnv("MINT_ADDRESS"));
  const ticker = optionalEnv("TICKER", "$ATTN");
  const treasuryKeypair = loadKeypair(requireEnv("TREASURY_KEYPAIR"));
  const devWallet = new PublicKey(optionalEnv("DEV_WALLET", treasuryKeypair.publicKey.toBase58()));
  const claimIntervalMs = Number(optionalEnv("CLAIM_INTERVAL_MS", String(15 * 60 * 1000)));
  const scanIntervalMs = Number(optionalEnv("SCAN_INTERVAL_MS", String(60 * 60 * 1000)));
  const buybackIntervalMs = Number(optionalEnv("BUYBACK_INTERVAL_MS", String(4 * 60 * 60 * 1000)));
  const epochLengthMs = Number(optionalEnv("EPOCH_LENGTH_MS", String(7 * 24 * 60 * 60 * 1000)));
  const feeBuybackShare = Number(optionalEnv("FEE_BUYBACK_SHARE", "0.5"));
  const revenueBuybackShare = Number(optionalEnv("REVENUE_BUYBACK_SHARE", "0.9"));
  const treasuryReserveLamports = Number(optionalEnv("TREASURY_RESERVE_LAMPORTS", String(0.05 * 1e9)));
  const adPriceLamportsPerDay = Number(optionalEnv("AD_PRICE_LAMPORTS_PER_DAY", String(0.5 * 1e9)));
  const burnBuybacks = optionalEnv("BURN_BUYBACKS", "false") === "true";
  const adminKey = requireEnv("ADMIN_KEY");
  const xBearerToken = process.env.X_BEARER_TOKEN ?? null;
  const newsApiKey = process.env.NEWS_API_KEY ?? null;
  const pumpFunProgramId = new PublicKey(
    optionalEnv("PUMPFUN_PROGRAM_ID", "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
  );
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const apiPort = Number(process.env.PORT ?? optionalEnv("API_PORT", "4000"));
  const corsOrigins = optionalEnv("CORS_ORIGINS", "*");

  for (const [name, v] of [
    ["FEE_BUYBACK_SHARE", feeBuybackShare],
    ["REVENUE_BUYBACK_SHARE", revenueBuybackShare],
  ] as const) {
    if (v < 0 || v > 1) throw new Error(`${name} must be between 0 and 1`);
  }
  if (claimIntervalMs < 60_000) throw new Error("CLAIM_INTERVAL_MS must be at least 60000");

  return {
    rpcUrl,
    mint,
    ticker,
    treasuryKeypair,
    devWallet,
    claimIntervalMs,
    scanIntervalMs,
    buybackIntervalMs,
    epochLengthMs,
    feeBuybackShare,
    revenueBuybackShare,
    treasuryReserveLamports,
    adPriceLamportsPerDay,
    burnBuybacks,
    adminKey,
    xBearerToken,
    newsApiKey,
    pumpFunProgramId,
    supabaseUrl,
    supabaseServiceRoleKey,
    apiPort,
    corsOrigins,
  };
}
