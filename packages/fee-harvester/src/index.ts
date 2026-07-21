import { loadConfig, makeConnection } from "@hodl/shared";
import { harvestPumpFunCreatorFees } from "./harvestPumpFunCreatorFees";

export {
  harvestPumpFunCreatorFees,
  deriveAmmCreatorVault,
  deriveBondingCurveCreatorVault,
  PUMP_PROGRAM_ID,
  PUMP_SWAP_PROGRAM_ID,
} from "./harvestPumpFunCreatorFees";

/**
 * One harvest: claim any accrued pump.fun creator fees into the game vault.
 * Called by the game-worker at the top of every 15-minute round cycle, or
 * run standalone via `npm run harvest`.
 */
export async function runHarvestCycle() {
  const config = loadConfig();
  const connection = makeConnection(config.rpcUrl);

  console.log("[harvester] claiming pump.fun creator fees into the game vault...");
  const results = await harvestPumpFunCreatorFees(connection, config.gameVaultKeypair).catch((err) => {
    console.warn("[harvester] pump.fun claim skipped:", err.message);
    return [];
  });
  results.forEach((r) => console.log(`[harvester] +${r.lamportsHarvested} lamports (${r.signature})`));
  return results;
}

if (require.main === module) {
  runHarvestCycle()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
