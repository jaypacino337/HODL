import { loadConfig, makeConnection } from "@sherwood/shared";
import { addLiquidityToPool } from "./addLiquidity";

export { addLiquidityToPool } from "./addLiquidity";

const RESERVE_LAMPORTS = 0.01 * 1e9; // leave a little SOL in the LP vault for its own tx fees

/**
 * Deposits the LP vault's spendable SOL balance into the ARROW/SOL pool.
 * No-ops until RAYDIUM_POOL_ID is set, which only exists once the token has
 * either graduated from pump.fun's bonding curve or been manually paired
 * on Raydium for a self-launch.
 */
export async function runAutoLpCycle() {
  const config = loadConfig();
  const connection = makeConnection(config.rpcUrl);

  const poolId = process.env.RAYDIUM_POOL_ID;
  if (!poolId) {
    console.warn("[autolp] RAYDIUM_POOL_ID not set — skipping (no pool to deposit into yet, e.g. pre-graduation).");
    return null;
  }

  const balance = await connection.getBalance(config.lpVaultKeypair.publicKey);
  const spendable = BigInt(Math.max(0, Math.round(balance - RESERVE_LAMPORTS)));

  if (spendable === 0n) {
    console.log("[autolp] nothing to deposit this cycle.");
    return null;
  }

  const cluster = config.rpcUrl.includes("devnet") ? "devnet" : "mainnet";
  const result = await addLiquidityToPool(connection, config.lpVaultKeypair, poolId, spendable, cluster);

  if (result) {
    console.log(`[autolp] deposited ${result.inputAmountLamports} lamports into pool ${poolId}: ${result.txId}`);
  }
  return result;
}

if (require.main === module) {
  runAutoLpCycle()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
