import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

export interface BuybackResult {
  status: "sent" | "failed" | "skipped";
  signature: string | null;
  note: string;
}

/**
 * Executes a market buy of the ecosystem token with `lamports` SOL from
 * the treasury — the on-chain half of "50% of fees / 90% of revenue go to
 * buybacks".
 *
 * Pre-graduation the buy goes through pump.fun's bonding curve
 * (@pump-fun/pump-sdk); after graduation through the PumpSwap AMM
 * (@pump-fun/pump-swap-sdk). Both SDKs are resolved at runtime like the
 * fee harvester's claim path, so this module degrades to a recorded
 * `skipped` row (funds stay pooled) instead of crashing when an SDK is
 * missing or pump.fun ships a breaking change.
 */
export async function executeBuyback(
  connection: Connection,
  treasury: Keypair,
  mint: PublicKey,
  lamports: bigint,
  slippageBps = 300
): Promise<BuybackResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PumpSdk } = require("@pump-fun/pump-sdk");
    const sdk = new PumpSdk(connection);
    const bondingCurve = await sdk.fetchBondingCurve(mint).catch(() => null);

    if (bondingCurve && !bondingCurve.complete) {
      const ixs = await sdk.buyInstructions({
        mint,
        user: treasury.publicKey,
        solAmount: lamports,
        slippageBps,
      });
      const tx = new Transaction().add(...ixs);
      const signature = await sendAndConfirmTransaction(connection, tx, [treasury]);
      return { status: "sent", signature, note: "bonding-curve buy" };
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PumpAmmSdk } = require("@pump-fun/pump-swap-sdk");
    const amm = new PumpAmmSdk(connection);
    const ixs = await amm.buyQuoteInstructions({
      mint,
      user: treasury.publicKey,
      quoteAmount: lamports,
      slippageBps,
    });
    const tx = new Transaction().add(...ixs);
    const signature = await sendAndConfirmTransaction(connection, tx, [treasury]);
    return { status: "sent", signature, note: "pumpswap buy" };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("Cannot find module")) {
      return {
        status: "skipped",
        signature: null,
        note: "pump.fun SDK not installed — funds stay pooled (npm i @pump-fun/pump-sdk @pump-fun/pump-swap-sdk)",
      };
    }
    return { status: "failed", signature: null, note: msg.slice(0, 300) };
  }
}
