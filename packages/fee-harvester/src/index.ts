import { loadConfig, makeConnection } from "@sherwood/shared";
import { harvestPumpFunCreatorFees } from "./harvestPumpFunCreatorFees";
import { splitHarvestedFees } from "./splitFees";

export { harvestPumpFunCreatorFees, deriveAmmCreatorVault, deriveBondingCurveCreatorVault } from "./harvestPumpFunCreatorFees";
export { harvestTransferFees } from "./harvestTransferFees";
export { splitHarvestedFees } from "./splitFees";

/** One full harvest cycle: claim pump.fun creator fees, split, done. Called by the snapshot-bot scheduler every 15 minutes, or run standalone via `npm run harvest`. */
export async function runHarvestCycle() {
  const config = loadConfig();
  const connection = makeConnection(config.rpcUrl);

  console.log("[harvester] claiming pump.fun creator fees...");
  const pumpResults = await harvestPumpFunCreatorFees(connection, config.feeAuthorityKeypair).catch((err) => {
    console.warn("[harvester] pump.fun claim skipped:", err.message);
    return [];
  });
  pumpResults.forEach((r) => console.log(`[harvester] +${r.lamportsHarvested} lamports (${r.signature})`));

  console.log("[harvester] splitting fee-authority balance into LP / rewards vaults...");
  const split = await splitHarvestedFees(
    connection,
    config.feeAuthorityKeypair,
    config.lpVaultKeypair.publicKey,
    config.rewardsVaultKeypair.publicKey,
    config.lpShare
  );
  console.log(`[harvester] -> LP vault: ${split.toLp} lamports, rewards vault: ${split.toRewards} lamports`, split.signature ?? "(nothing to split)");

  return { pumpResults, split };
}

if (require.main === module) {
  runHarvestCycle()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
