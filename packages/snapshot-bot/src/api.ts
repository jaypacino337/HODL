import cors from "cors";
import express from "express";
import { loadConfig } from "@sherwood/shared";
import type { StatsResponse } from "@sherwood/shared";
import { SherwoodDb } from "./db";

export function startApi(db: SherwoodDb) {
  const config = loadConfig();
  const app = express();
  app.use(cors());

  app.get("/api/stats", (_req, res) => {
    const lastSnapshot = db.getLatestSnapshot();
    const nextSnapshotAt = lastSnapshot
      ? new Date(new Date(lastSnapshot.takenAt).getTime() + config.snapshotIntervalMs).toISOString()
      : null;

    const response: StatsResponse = {
      mint: config.mint.toBase58(),
      lastSnapshot,
      nextSnapshotAt,
      totalDistributedLamports: db.getTotalDistributedLamports(),
      totalHarvestedLamports: db.getTotalHarvestedLamports(),
      holderCount: lastSnapshot?.holderCount ?? 0,
    };
    res.json(response);
  });

  app.get("/api/distributions/recent", (req, res) => {
    const lastSnapshot = db.getLatestSnapshot();
    if (!lastSnapshot) {
      res.json([]);
      return;
    }
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    res.json(db.getRecentDistributions(lastSnapshot.id, limit));
  });

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.listen(config.apiPort, () => {
    console.log(`[api] stats API listening on :${config.apiPort}`);
  });

  return app;
}
