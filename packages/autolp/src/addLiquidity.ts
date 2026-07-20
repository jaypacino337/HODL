/**
 * Deposits the LP vault's SOL (paired with an equivalent value of $ARROW,
 * held by the same vault) into the existing Raydium CPMM pool for
 * ARROW/SOL. This is what turns harvested trading fees into permanent,
 * locked-deeper liquidity instead of just sitting in a wallet.
 *
 * Requires a pool to already exist (created once the token graduates from
 * pump.fun's bonding curve to PumpSwap/Raydium, or manually if self-launched).
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Percent, Raydium, TxVersion, type ApiV3PoolInfoStandardItemCpmm } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";

function assertCpmmPool(poolInfo: { type: string; id: string }): asserts poolInfo is ApiV3PoolInfoStandardItemCpmm {
  if (poolInfo.type !== "Standard") {
    throw new Error(
      `Pool ${poolInfo.id} is a "${poolInfo.type}" pool, not a Standard CPMM pool. ` +
        "This module only knows how to add liquidity to Raydium's CPMM pools."
    );
  }
}

export interface AutoLpResult {
  txId: string;
  inputAmountLamports: string;
}

export async function addLiquidityToPool(
  connection: Connection,
  lpVaultOwner: Keypair,
  poolId: string,
  solAmountLamports: bigint,
  cluster: "mainnet" | "devnet" = "mainnet"
): Promise<AutoLpResult | null> {
  if (solAmountLamports <= 0n) return null;

  const raydium = await Raydium.load({
    connection,
    owner: lpVaultOwner,
    cluster,
    disableLoadToken: false,
  });

  let poolInfo;
  let poolKeys;
  if (cluster === "mainnet") {
    const data = await raydium.api.fetchPoolById({ ids: poolId });
    poolInfo = data[0];
  } else {
    const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
    poolInfo = data.poolInfo;
    poolKeys = data.poolKeys;
  }

  if (!poolInfo) {
    throw new Error(`Pool ${poolId} not found on ${cluster}`);
  }
  assertCpmmPool(poolInfo);

  const { execute } = await raydium.cpmm.addLiquidity({
    poolInfo,
    poolKeys,
    inputAmount: new BN(solAmountLamports.toString()),
    slippage: new Percent(1, 100), // 1%
    baseIn: false, // fixing the quote (SOL) side; ARROW side computed from pool ratio
    txVersion: TxVersion.V0,
  });

  const { txId } = await execute({ sendAndConfirm: true });

  return { txId, inputAmountLamports: solAmountLamports.toString() };
}

export function derivePoolIdFromEnv(): PublicKey | null {
  const raw = process.env.RAYDIUM_POOL_ID;
  return raw ? new PublicKey(raw) : null;
}
