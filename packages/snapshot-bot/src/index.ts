import { loadConfig } from "@sherwood/shared";
import { SherwoodDb } from "./db";
import { startScheduler } from "./scheduler";
import { startApi } from "./api";

export { SherwoodDb } from "./db";
export { fetchHolders } from "./holders";
export { computePayouts, sendPayouts } from "./distribute";
export { runFullCycle, startScheduler } from "./scheduler";
export { startApi } from "./api";

function main() {
  const config = loadConfig();
  const db = new SherwoodDb(config.dbPath);

  startApi(db);
  startScheduler(db);

  const shutdown = () => {
    console.log("\n[bot] shutting down...");
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  main();
}
