/**
 * Shared plumbing for the operational scripts.
 *
 * Two rules these helpers exist to enforce, because both were expensive to learn:
 *
 *   1. `costGate()` prints exactly what a step costs, who pays, whether it comes back,
 *      and how long it takes — then waits for an explicit "yes". No on-chain action
 *      happens without it.
 *   2. `requireBalance()` checks the wallet immediately before the step. Never begin a
 *      step you cannot finish with the SOL currently in the wallet.
 */
import { createInterface } from "node:readline/promises";
import { readFileSync } from "node:fs";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { CLUSTER } from "../config/index.ts";

export type CostRow = {
  step: string;
  sol: number;
  wallet: string;
  recoverable: boolean;
  seconds: number;
};

export function rpcEndpoint(): string {
  const key = process.env.HELIUS_API_KEY;
  if (key) {
    const net = CLUSTER === "mainnet-beta" ? "mainnet" : "devnet";
    return `https://${net}.helius-rpc.com/?api-key=${key}`;
  }
  return CLUSTER === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";
}

export const connection = () => new Connection(rpcEndpoint(), "confirmed");

export function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

/**
 * Prints the cost table and blocks until the operator types "yes".
 *
 * `--yes` skips the prompt for automated devnet runs. It is deliberately refused on
 * mainnet: an unattended mainnet spend is exactly the failure this whole file exists
 * to prevent.
 */
export async function costGate(rows: CostRow[]): Promise<void> {
  const total = rows.reduce((a, r) => a + r.sol, 0);
  const recoverable = rows.filter((r) => r.recoverable).reduce((a, r) => a + r.sol, 0);
  const seconds = rows.reduce((a, r) => a + r.seconds, 0);

  console.log(`\n  COST GATE — cluster: ${CLUSTER}\n`);
  console.log(
    "  STEP".padEnd(44) +
      "SOL".padStart(10) +
      "  WALLET".padEnd(14) +
      "RECOVERABLE".padStart(12) +
      "TIME".padStart(9),
  );
  console.log("  " + "-".repeat(87));
  for (const r of rows) {
    console.log(
      "  " +
        r.step.padEnd(42) +
        r.sol.toFixed(6).padStart(10) +
        "  " +
        r.wallet.padEnd(12) +
        (r.recoverable ? "yes" : "NO").padStart(12) +
        `${r.seconds}s`.padStart(9),
    );
  }
  console.log("  " + "-".repeat(87));
  console.log(
    `  TOTAL ${total.toFixed(6)} SOL — ${recoverable.toFixed(6)} recoverable, ` +
      `${(total - recoverable).toFixed(6)} spent for good. ~${seconds}s.\n`,
  );

  if (process.argv.includes("--yes")) {
    if (CLUSTER === "mainnet-beta") {
      throw new Error("--yes is refused on mainnet. Approve this one by hand.");
    }
    console.log("  --yes given (devnet). Proceeding.\n");
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('  Type "yes" to proceed: ')).trim().toLowerCase();
  rl.close();
  if (answer !== "yes") throw new Error("Aborted at the cost gate.");
}

/** Never begin a step you cannot finish. Checked immediately before, every time. */
export async function requireBalance(
  wallet: PublicKey,
  neededSol: number,
  margin = 1.2,
): Promise<void> {
  const lamports = await connection().getBalance(wallet);
  const have = lamports / LAMPORTS_PER_SOL;
  const need = neededSol * margin;
  console.log(
    `  balance ${have.toFixed(6)} SOL, need ~${need.toFixed(6)} (incl. ${Math.round((margin - 1) * 100)}% margin)`,
  );
  if (have < need) {
    throw new Error(
      `STOP: wallet ${wallet.toBase58()} holds ${have.toFixed(6)} SOL but this step ` +
        `needs ~${need.toFixed(6)}. Top up ${(need - have).toFixed(6)} SOL before retrying. ` +
        `Nothing has been sent.`,
    );
  }
}

export function explorer(sig: string): string {
  const q = CLUSTER === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://solscan.io/tx/${sig}${q}`;
}

export function die(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}
