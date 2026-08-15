/**
 * Claims the ecosystem's pump.fun creator rewards — the fee stream that
 * powers the Attention Markets flywheel: 50% buybacks, 50% attention rewards.
 *
 * pump.fun mints plain SPL tokens on a bonding curve — there is no
 * per-transfer tax to intercept. Instead, pump.fun accrues a share of
 * trading fees into a per-creator PDA vault, which the creator (the wallet
 * that launched the coin) can claim at any time via a permissionless
 * `collectCreatorFee` instruction. Post-graduation (once the bonding curve
 * migrates to a PumpSwap AMM pool), the equivalent claim happens against
 * the PumpSwap program instead.
 *
 * Verified against pump.fun's public docs (github.com/pump-fun/pump-public-docs):
 *   - Pump (bonding curve) program: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
 *   - PumpSwap (AMM) program:       pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA
 *   - Creator vault PDA seeds: ["creator-vault", creator] (bonding curve)
 *                              ["creator_vault", coinCreator] (AMM)
 *
 * This module delegates instruction-building to pump.fun's official SDKs
 * (`@pump-fun/pump-sdk`, `@pump-fun/pump-swap-sdk`) rather than hand-rolling
 * Anchor discriminators, since those packages track pump.fun's on-chain
 * program as it evolves. Pin exact function names against whatever SDK
 * version you install (`npm ls @pump-fun/pump-sdk`) — pump.fun has shipped
 * breaking instruction changes before (the collect_creator_fee ->
 * collect_creator_fee_v2 migration, for one).
 */
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import type { HarvestResult } from "@attn/shared";

export const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const PUMP_SWAP_PROGRAM_ID = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");

export function deriveBondingCurveCreatorVault(creator: PublicKey): PublicKey {
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_PROGRAM_ID
  );
  return vault;
}

export function deriveAmmCreatorVault(coinCreator: PublicKey): PublicKey {
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), coinCreator.toBuffer()],
    PUMP_SWAP_PROGRAM_ID
  );
  return vault;
}

/**
 * Claims accrued creator fees from both the bonding-curve vault (pre-graduation)
 * and the AMM vault (post-graduation). Either leg is a no-op if its vault is
 * empty or the coin hasn't reached that phase yet. Fees land as SOL in the
 * creator wallet — which IS the Attention Markets treasury.
 */
export async function harvestPumpFunCreatorFees(
  connection: Connection,
  creator: Keypair
): Promise<HarvestResult[]> {
  const results: HarvestResult[] = [];

  const bondingVault = deriveBondingCurveCreatorVault(creator.publicKey);
  const ammVault = deriveAmmCreatorVault(creator.publicKey);

  const [bondingBalance, ammBalance] = await Promise.all([
    connection.getBalance(bondingVault).catch(() => 0),
    connection.getBalance(ammVault).catch(() => 0),
  ]);

  if (bondingBalance > 0) {
    const sig = await claimBondingCurveCreatorFee(connection, creator);
    results.push({ source: "pumpfun_creator_fee", lamportsHarvested: String(bondingBalance), signature: sig });
  }

  if (ammBalance > 0) {
    const sig = await claimAmmCreatorFee(connection, creator);
    results.push({ source: "pumpfun_creator_fee", lamportsHarvested: String(ammBalance), signature: sig });
  }

  return results;
}

async function claimBondingCurveCreatorFee(connection: Connection, creator: Keypair): Promise<string> {
  // Preferred: official SDK, which stays in sync with pump.fun's Anchor IDL.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PumpSdk } = require("@pump-fun/pump-sdk");
    const sdk = new PumpSdk(connection);
    const ixs = await sdk.collectCreatorFeeV2Instructions({ creator: creator.publicKey });
    const tx = new Transaction().add(...ixs);
    return await sendAndConfirmTransaction(connection, tx, [creator]);
  } catch (err) {
    throw new Error(
      "Failed to claim bonding-curve creator fee via @pump-fun/pump-sdk. " +
        "Install it (`npm i @pump-fun/pump-sdk`) and confirm the exported function name " +
        "still matches collectCreatorFeeV2Instructions for your installed version. " +
        `Underlying error: ${(err as Error).message}`
    );
  }
}

async function claimAmmCreatorFee(connection: Connection, creator: Keypair): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PumpAmmSdk } = require("@pump-fun/pump-swap-sdk");
    const sdk = new PumpAmmSdk(connection);
    const ixs = await sdk.collectCoinCreatorFeeInstructions({ coinCreator: creator.publicKey });
    const tx = new Transaction().add(...ixs);
    return await sendAndConfirmTransaction(connection, tx, [creator]);
  } catch (err) {
    throw new Error(
      "Failed to claim AMM creator fee via @pump-fun/pump-swap-sdk. " +
        "Install it (`npm i @pump-fun/pump-swap-sdk`) and confirm the exported function name " +
        "still matches collectCoinCreatorFeeInstructions for your installed version. " +
        `Underlying error: ${(err as Error).message}`
    );
  }
}
