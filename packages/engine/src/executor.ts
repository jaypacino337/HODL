import { createPublicClient, createWalletClient, http, keccak256, parseUnits, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "node:crypto";
import type { ExecutionIntent, Proposal, Receipt, AgentVote, HolderVoteTally } from "@board/shared";
import type { EngineConfig } from "./config";

/**
 * Guarded execution. Agents never touch this file's code path directly —
 * the orchestrator turns PASSED proposals into intents, and only a
 * configured keeper key can submit them to the on-chain TreasuryExecutor,
 * which re-enforces every limit independently (allowlists, per-action and
 * daily caps, expiry, idempotency, pause). Simulation always precedes
 * submission; failures are recorded, never retried blindly.
 */

const EXECUTOR_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "bytes32" },
      { name: "action", type: "uint8" },
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

/** v1 on-chain support: BURN (buyback burn leg) and TRANSFER (funding). */
const ONCHAIN_ACTIONS = new Set(["BUYBACK_BURN", "FUND_DEVELOPMENT", "FUND_COMMUNITY", "HOLDER_AIRDROP"]);

export function buildIntent(p: Proposal): ExecutionIntent {
  return {
    id: `intent-${randomUUID().slice(0, 8)}`,
    proposalId: p.id,
    idempotencyKey: keccak256(toBytes(`${p.id}:${p.revision}`)),
    actionType: p.actionType,
    asset: p.asset,
    recipient: p.recipient,
    amountUsd: p.amountUsd,
    maxSlippageBps: p.maxSlippageBps,
    expiresAt: p.expiresAt,
    simulated: false,
    status: "PENDING",
  };
}

export function isOnchainExecutable(p: Proposal): boolean {
  return ONCHAIN_ACTIONS.has(p.actionType);
}

/**
 * Attempt guarded on-chain execution of one intent. Returns a Receipt on
 * confirmation, or null when execution is not configured / not supported —
 * the intent then stays PENDING and the UI says so truthfully.
 */
export async function maybeExecute(
  cfg: EngineConfig,
  intent: ExecutionIntent,
  proposal: Proposal,
  votes: AgentVote[],
  holderTally: HolderVoteTally | null
): Promise<{ receipt: Receipt | null; intent: ExecutionIntent }> {
  const keeperKey = process.env.KEEPER_PRIVATE_KEY;
  if (!cfg.executorAddress || !keeperKey || !cfg.rpcUrl || !cfg.usdgAddress) {
    return { receipt: null, intent }; // execution not active
  }
  if (!isOnchainExecutable(proposal)) {
    return { receipt: null, intent }; // e.g. stock acquisition → multisig queue
  }

  const tokenAddress = proposal.asset === "BOARD" ? cfg.boardTokenAddress : cfg.usdgAddress;
  if (!tokenAddress) return { receipt: null, intent };

  const account = privateKeyToAccount(keeperKey as `0x${string}`);
  const pub = createPublicClient({ transport: http(cfg.rpcUrl) });
  const wallet = createWalletClient({ account, transport: http(cfg.rpcUrl) });

  const isBurn = proposal.actionType === "BUYBACK_BURN";
  const to = isBurn
    ? ("0x000000000000000000000000000000000000dEaD" as `0x${string}`)
    : (proposal.recipient as `0x${string}`);
  const amount = parseUnits(String(proposal.amountUsd), 6); // USDG 6 decimals; BOARD burn amount priced upstream
  const args = [
    intent.idempotencyKey as `0x${string}`,
    isBurn ? 1 : 0,
    tokenAddress,
    to,
    amount,
    BigInt(Math.floor(new Date(intent.expiresAt).getTime() / 1000)),
  ] as const;

  try {
    // simulate before submission — reverts surface here, nothing is sent
    const { request } = await pub.simulateContract({
      account,
      address: cfg.executorAddress,
      abi: EXECUTOR_ABI,
      functionName: "execute",
      args,
    });
    intent = { ...intent, simulated: true, status: "SIMULATED" };
    const hash = await wallet.writeContract(request);
    intent = { ...intent, status: "SUBMITTED" };
    const rcpt = await pub.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (rcpt.status !== "success") {
      return { receipt: null, intent: { ...intent, status: "FAILED" } };
    }
    intent = { ...intent, status: "CONFIRMED" };
    const block = await pub.getBlock({ blockNumber: rcpt.blockNumber });
    return {
      intent,
      receipt: {
        proposalId: proposal.id,
        txHash: hash,
        chainId: cfg.chainId,
        blockNumber: Number(rcpt.blockNumber),
        timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
        asset: proposal.asset,
        amountUsd: proposal.amountUsd,
        recipient: isBurn ? null : to,
        agentVotes: votes,
        holderTally,
        finalStatus: "EXECUTED",
      },
    };
  } catch (err) {
    return { receipt: null, intent: { ...intent, status: intent.simulated ? "FAILED" : "ABORTED" } };
  }
}
