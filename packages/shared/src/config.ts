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

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export interface SherwoodConfig {
  rpcUrl: string;
  mint: PublicKey;
  /** Wallet allowed to withdraw Token-2022 withheld transfer fees / pump.fun creator rewards. */
  feeAuthorityKeypair: Keypair;
  /** Vault that accumulates the LP-bound share of harvested fees and signs the auto-LP deposit txs. */
  lpVaultKeypair: Keypair;
  /** Vault that accumulates the holder-rewards share of harvested fees, and pays out airdrops. */
  rewardsVaultKeypair: Keypair;
  /** Fraction (0-1) of harvested fees routed to the LP vault. Remainder goes to holder rewards. */
  lpShare: number;
  /** How often holders are snapshotted and paid, in milliseconds. Default: 15 minutes. */
  snapshotIntervalMs: number;
  /** Token accounts excluded from snapshots (treasury, LP, burn, CEX hot wallets, etc). */
  excludedOwners: Set<string>;
  /** Minimum token balance (raw base units) required to be eligible for an airdrop. */
  minEligibleBalance: bigint;
  pumpFunProgramId: PublicKey;
  dbPath: string;
  apiPort: number;
}

export function loadConfig(): SherwoodConfig {
  const rpcUrl = optionalEnv("RPC_URL", "https://api.devnet.solana.com");
  const mint = new PublicKey(requireEnv("MINT_ADDRESS"));
  const feeAuthorityKeypair = loadKeypair(requireEnv("FEE_AUTHORITY_KEYPAIR_PATH"));
  const lpVaultKeypair = loadKeypair(requireEnv("LP_VAULT_KEYPAIR_PATH"));
  const rewardsVaultKeypair = loadKeypair(requireEnv("REWARDS_VAULT_KEYPAIR_PATH"));
  const lpShare = Number(optionalEnv("LP_SHARE", "0.5"));
  const snapshotIntervalMs = Number(optionalEnv("SNAPSHOT_INTERVAL_MS", String(15 * 60 * 1000)));
  const excludedOwners = new Set(
    optionalEnv("EXCLUDED_OWNERS", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const minEligibleBalance = BigInt(optionalEnv("MIN_ELIGIBLE_BALANCE", "1"));
  const pumpFunProgramId = new PublicKey(
    optionalEnv("PUMPFUN_PROGRAM_ID", "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
  );
  const dbPath = optionalEnv("DB_PATH", "./data/sherwood.sqlite");
  const apiPort = Number(optionalEnv("API_PORT", "4000"));

  if (lpShare < 0 || lpShare > 1) {
    throw new Error("LP_SHARE must be between 0 and 1");
  }

  return {
    rpcUrl,
    mint,
    feeAuthorityKeypair,
    lpVaultKeypair,
    rewardsVaultKeypair,
    lpShare,
    snapshotIntervalMs,
    excludedOwners,
    minEligibleBalance,
    pumpFunProgramId,
    dbPath,
    apiPort,
  };
}
