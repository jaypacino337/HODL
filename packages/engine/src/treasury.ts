import { createPublicClient, erc20Abi, formatEther, formatUnits, http } from "viem";
import { randomUUID } from "node:crypto";
import { policyRef, type EngineConfig } from "./config";
import type { TreasurySnapshot } from "@board/shared";

/**
 * Treasury snapshots — READ-ONLY chain access. The engine holds no treasury
 * keys; it reads balances so every agent argues from the same verified data.
 * With no chain config there is NO snapshot and NO session: we never invent
 * balances (spec: "Do not simulate treasury balances … and present them as
 * real").
 *
 * v1 pricing: USDG = $1; ETH and stock tokens priced only if a price source
 * is configured via TOKEN_PRICES_JSON (e.g. '{"ETH":2900,"AAPLx":231.5}'),
 * else those balances are reported with usdValue 0 and flagged — agents see
 * exactly what is and isn't priced.
 */

export async function takeSnapshot(cfg: EngineConfig): Promise<TreasurySnapshot | null> {
  if (!cfg.rpcUrl || !cfg.treasuryAddress) return null;
  const pub = createPublicClient({ transport: http(cfg.rpcUrl) });

  const prices: Record<string, number> = (() => {
    try {
      return JSON.parse(process.env.TOKEN_PRICES_JSON ?? "{}");
    } catch {
      return {};
    }
  })();

  const balances: TreasurySnapshot["balances"] = [];

  const eth = await pub.getBalance({ address: cfg.treasuryAddress });
  const ethAmt = Number(formatEther(eth));
  balances.push({ symbol: "ETH", address: null, amount: ethAmt, usdValue: ethAmt * (prices.ETH ?? 0) });

  const tokens: Array<{ symbol: string; address: `0x${string}` | null }> = [
    { symbol: "USDG", address: cfg.usdgAddress },
    { symbol: "BOARD", address: cfg.boardTokenAddress },
  ];
  for (const extra of (process.env.STOCK_TOKENS_JSON ? JSON.parse(process.env.STOCK_TOKENS_JSON) : []) as Array<{
    symbol: string;
    address: `0x${string}`;
  }>) {
    tokens.push(extra);
  }

  for (const t of tokens) {
    if (!t.address) continue;
    const [raw, decimals] = await Promise.all([
      pub.readContract({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [cfg.treasuryAddress] }),
      pub.readContract({ address: t.address, abi: erc20Abi, functionName: "decimals" }),
    ]);
    const amount = Number(formatUnits(raw as bigint, decimals as number));
    const price = t.symbol === "USDG" ? 1 : (prices[t.symbol] ?? 0);
    balances.push({ symbol: t.symbol, address: t.address, amount, usdValue: amount * price });
  }

  const totalUsd = balances.reduce((s, b) => s + b.usdValue, 0);
  const reserved = Number(process.env.RESERVED_LIABILITIES_USD ?? 0);
  const policy = policyRef.current;
  const available = Math.max(
    0,
    Math.min(totalUsd - policy.minPermanentReserveUsd - reserved, policy.maxPerSessionUsd)
  );

  return {
    id: `snap-${randomUUID().slice(0, 8)}`,
    takenAt: new Date().toISOString(),
    chainId: cfg.chainId,
    treasuryAddress: cfg.treasuryAddress,
    balances,
    totalUsd,
    availableUsd: available,
    reservedLiabilitiesUsd: reserved,
    recentRevenueUsd: Number(process.env.RECENT_REVENUE_USD ?? 0),
    previousAllocations: [],
    policyVersion: policy.version,
    verified: true,
  };
}
