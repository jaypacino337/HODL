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
 * no filesystem secrets, so `GAME_VAULT_KEYPAIR` is usually the raw
 * `[12,34,...]` array pasted into a variable.
 */
function loadKeypair(pathOrJson: string): Keypair {
  const raw = pathOrJson.trim().startsWith("[")
    ? JSON.parse(pathOrJson)
    : JSON.parse(fs.readFileSync(pathOrJson, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export interface HodlConfig {
  rpcUrl: string;
  /** The $HODL token mint (the pump.fun coin). */
  mint: PublicKey;
  /**
   * The wallet that created the coin on pump.fun. It claims creator fees
   * (creator-fee vaults are keyed by creator pubkey), holds the game pot,
   * and signs the winner payouts. One wallet, three jobs — keep it funded
   * with a little SOL for tx fees.
   */
  gameVaultKeypair: Keypair;
  /** How often fees are claimed and a round settles, in ms. Default: 15 minutes. */
  roundIntervalMs: number;
  /** Picks lock this many ms before settlement so late entries can't game the flip. */
  pickLockBufferMs: number;
  /** Minimum whole-token balance required to play. Default: 500,000. */
  minHoldTokens: number;
  /** SOL (in lamports) always left in the vault to cover future tx fees. */
  vaultReserveLamports: number;
  /** Wallets excluded from playing/winning (vault itself, LP pools, CEX wallets...). */
  excludedOwners: Set<string>;
  pumpFunProgramId: PublicKey;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  apiPort: number;
  /** Comma-separated list of allowed CORS origins for the API ("*" for any). */
  corsOrigins: string;
}

export function loadConfig(): HodlConfig {
  const rpcUrl = optionalEnv("RPC_URL", "https://api.devnet.solana.com");
  const mint = new PublicKey(requireEnv("MINT_ADDRESS"));
  const gameVaultKeypair = loadKeypair(requireEnv("GAME_VAULT_KEYPAIR"));
  const roundIntervalMs = Number(optionalEnv("ROUND_INTERVAL_MS", String(15 * 60 * 1000)));
  const pickLockBufferMs = Number(optionalEnv("PICK_LOCK_BUFFER_MS", String(30 * 1000)));
  const minHoldTokens = Number(optionalEnv("MIN_HOLD_TOKENS", "500000"));
  const vaultReserveLamports = Number(optionalEnv("VAULT_RESERVE_LAMPORTS", String(0.02 * 1e9)));
  const excludedOwners = new Set(
    optionalEnv("EXCLUDED_OWNERS", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  // The vault must never win its own pot.
  excludedOwners.add(gameVaultKeypair.publicKey.toBase58());
  const pumpFunProgramId = new PublicKey(
    optionalEnv("PUMPFUN_PROGRAM_ID", "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
  );
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const apiPort = Number(process.env.PORT ?? optionalEnv("API_PORT", "4000"));
  const corsOrigins = optionalEnv("CORS_ORIGINS", "*");

  if (roundIntervalMs < 60_000) {
    throw new Error("ROUND_INTERVAL_MS must be at least 60000 (1 minute)");
  }
  if (pickLockBufferMs >= roundIntervalMs) {
    throw new Error("PICK_LOCK_BUFFER_MS must be smaller than ROUND_INTERVAL_MS");
  }

  return {
    rpcUrl,
    mint,
    gameVaultKeypair,
    roundIntervalMs,
    pickLockBufferMs,
    minHoldTokens,
    vaultReserveLamports,
    excludedOwners,
    pumpFunProgramId,
    supabaseUrl,
    supabaseServiceRoleKey,
    apiPort,
    corsOrigins,
  };
}
