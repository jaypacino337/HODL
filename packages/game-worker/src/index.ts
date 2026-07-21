import cron from "node-cron";
import { loadConfig, makeConnection } from "@hodl/shared";
import { GameDb } from "./db";
import { getMintDecimals } from "./balances";
import { ensureOpenRound, runGameCycle } from "./engine";
import { buildApi } from "./api";

/**
 * HODL OR NO HODL game worker — the single Railway service that:
 *   - claims pump.fun creator fees every 15 minutes,
 *   - settles each round (coin flip + weighted payouts),
 *   - opens the next round,
 *   - serves the game API the website talks to.
 */
async function main() {
  const config = loadConfig();
  const connection = makeConnection(config.rpcUrl);
  const db = new GameDb(config.supabaseUrl, config.supabaseServiceRoleKey);

  const tokenDecimals = await getMintDecimals(connection, config.mint);
  console.log(
    `[worker] mint ${config.mint.toBase58()} (${tokenDecimals} decimals), ` +
      `vault ${config.gameVaultKeypair.publicKey.toBase58()}, ` +
      `min hold ${config.minHoldTokens.toLocaleString()} tokens, ` +
      `round every ${Math.round(config.roundIntervalMs / 60000)} min`
  );

  // Make sure players can pick the moment the worker boots.
  await ensureOpenRound(config, db);

  const app = buildApi(config, connection, db, tokenDecimals);
  app.listen(config.apiPort, () => console.log(`[worker] API listening on :${config.apiPort}`));

  const intervalMinutes = Math.max(1, Math.round(config.roundIntervalMs / 60_000));
  const expression = intervalMinutes >= 60 ? "0 * * * *" : `*/${intervalMinutes} * * * *`;
  console.log(`[worker] game cycle cron: "${expression}"`);
  cron.schedule(expression, () => {
    runGameCycle(config, connection, db, tokenDecimals).catch((err) =>
      console.error("[worker] cycle threw:", err)
    );
  });

  // Also watch for an overdue round between cron ticks (e.g. after a
  // restart) so settlement never silently stalls.
  setInterval(async () => {
    try {
      const round = await db.getOpenRound();
      if (round && new Date(round.settlesAt).getTime() + 60_000 < Date.now()) {
        console.log("[worker] found overdue round — running catch-up cycle");
        await runGameCycle(config, connection, db, tokenDecimals);
      }
    } catch (err) {
      console.error("[worker] overdue check failed:", (err as Error).message);
    }
  }, 30_000);
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
