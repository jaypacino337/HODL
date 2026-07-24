import express from "express";
import cors from "cors";
import { LAUNCH_MARKETS, getMarket } from "@overbid/shared";
import { OracleDb } from "./db";
import { FEEDS, ParclClient } from "./parcl";
import { computeSettlement } from "./settle";

/**
 * OVERBID oracle/settlement worker (deploy to Railway).
 *
 *   loop:  Parcl Labs → index_observations ledger → settle matured markets
 *   api:   read endpoints the website uses when NEXT_PUBLIC_API_URL is set
 *
 * Without SUPABASE_* + PARCL_LABS_API_KEY it still boots and serves the
 * market definitions, so the API shape can be developed against locally.
 * On-chain resolution (IndexOracle.resolveMarket) is wired in once contract
 * addresses exist — the settlement row records everything needed to post.
 */

const PORT = Number(process.env.PORT ?? 4000);
const POLL_MINUTES = Math.max(15, Number(process.env.ORACLE_POLL_MINUTES ?? 360));

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const parclKey = process.env.PARCL_LABS_API_KEY ?? "";

const db = supabaseUrl && supabaseKey ? new OracleDb(supabaseUrl, supabaseKey) : null;
const parcl = parclKey ? new ParclClient(parclKey) : null;

async function pollOnce(): Promise<void> {
  if (!db) return console.warn("[oracle] no Supabase config — skipping poll");

  // keep market definitions mirrored in the ledger
  for (const m of LAUNCH_MARKETS) await db.upsertMarket(m);

  if (parcl) {
    const earliestWindow = LAUNCH_MARKETS.map((m) => m.rule.windowStart).sort()[0];
    for (const feed of FEEDS) {
      try {
        await db.upsertFeed(feed.id, feed.city, feed.metric);
        const series = await parcl.fetchSeries(feed, earliestWindow);
        await db.upsertObservations(feed.id, series);
        console.log(`[oracle] ${feed.id}: ${series.length} points`);
      } catch (err) {
        console.error(`[oracle] feed ${feed.id} failed:`, err);
      }
    }
  } else {
    console.warn("[oracle] no PARCL_LABS_API_KEY — index fetch skipped");
  }

  // settle anything whose window has fully elapsed
  const now = new Date().toISOString();
  for (const slug of await db.unsettledMarketSlugs()) {
    const m = getMarket(slug);
    if (!m || m.settlesAt > now) continue;
    try {
      const { settlement, evidence } = await computeSettlement(db, m);
      await db.recordSettlement(settlement, evidence);
      console.log(`[oracle] settled ${slug}: ${settlement.winningOutcomeId} wins`, settlement.changesPct);
    } catch (err) {
      console.error(`[oracle] cannot settle ${slug} yet:`, err);
    }
  }
}

// ── API ────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGINS ?? "*").split(",") }));

app.get("/health", (_req, res) => res.json({ ok: true, live: Boolean(db && parcl) }));

app.get("/markets", (_req, res) => res.json({ markets: LAUNCH_MARKETS }));

app.get("/markets/:slug", (req, res) => {
  const m = getMarket(req.params.slug);
  if (!m) return res.status(404).json({ error: "unknown market" });
  return res.json({ market: m });
});

app.get("/feeds/:id/history", async (req, res) => {
  if (!db) return res.json({ history: [] });
  try {
    res.json({ history: await db.feedHistory(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/settlements", async (_req, res) => {
  if (!db) return res.json({ settlements: [] });
  try {
    res.json({ settlements: await db.getSettlements() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`[oracle] api on :${PORT}, polling every ${POLL_MINUTES}m`);
  void pollOnce();
  setInterval(() => void pollOnce(), POLL_MINUTES * 60_000);
});
