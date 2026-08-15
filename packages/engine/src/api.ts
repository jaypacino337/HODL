import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { randomBytes } from "crypto";
import { Connection } from "@solana/web3.js";
import {
  AttnConfig,
  FeedEvent,
  OverviewResponse,
  PlayerResponse,
  ScanResponse,
  bookAdMessage,
  submitPostMessage,
  tierFor,
} from "@attn/shared";
import { AttnDb } from "./db";
import { verifyWalletSignature, isValidPostUrl } from "./verify";
import { autoVerifyPost } from "./points";
import { verifyPaymentToTreasury } from "./payments";
import { ensureOpenEpoch } from "./engine";

/**
 * The public terminal API.
 *
 *   GET  /health
 *   GET  /api/overview            — totals, pools, epoch, splits
 *   GET  /api/scan                — latest attention scan
 *   GET  /api/leaderboard         — lifetime + epoch attention ranks
 *   GET  /api/player/:wallet      — points, tier, submissions
 *   GET  /api/feed                — recent engine events (terminal tape)
 *   POST /api/attention/submit    — submit a signed X post for points
 *   GET  /api/ads                 — active ads
 *   POST /api/ads/book            — create a booking (signed)
 *   POST /api/ads/confirm         — confirm with the payment tx signature
 *   POST /api/admin/review-post   — approve/deny a post   (x-admin-key)
 *   POST /api/admin/review-ad     — reject an ad          (x-admin-key)
 */
export function buildApi(config: AttnConfig, connection: Connection, db: AttnDb): Express {
  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin: config.corsOrigins === "*" ? true : config.corsOrigins.split(",").map((s) => s.trim()),
    })
  );

  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, _next: NextFunction) =>
      fn(req, res).catch((err) => {
        console.error(`[api] ${req.method} ${req.path} failed:`, (err as Error).message);
        res.status(500).json({ error: "internal error" });
      });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get(
    "/api/overview",
    wrap(async (_req, res) => {
      const [totals, epoch, scan, lastClaimAt] = await Promise.all([
        db.platformTotals(),
        ensureOpenEpoch(config, db),
        db.latestScan(),
        db.lastClaimAt(),
      ]);
      const body: OverviewResponse = {
        ticker: config.ticker,
        mint: config.mint.toBase58(),
        treasury: config.treasuryKeypair.publicKey.toBase58(),
        totals: {
          feesClaimedLamports: totals.feesClaimedLamports,
          buybackSpentLamports: totals.buybackSpentLamports,
          rewardsPaidLamports: totals.rewardsPaidLamports,
          adRevenueLamports: totals.adRevenueLamports,
          devPaidLamports: totals.devPaidLamports,
        },
        pools: {
          buybackPoolLamports: totals.buybackPoolLamports,
          rewardsPoolLamports: epoch.rewardsPoolLamports,
        },
        epoch: { ...epoch, msRemaining: Math.max(0, new Date(epoch.endsAt).getTime() - Date.now()) },
        splits: {
          feeBuybackShare: config.feeBuybackShare,
          revenueBuybackShare: config.revenueBuybackShare,
        },
        adPriceLamportsPerDay: String(config.adPriceLamportsPerDay),
        lastScanAt: scan?.ranAt ?? null,
        lastClaimAt,
      };
      res.json(body);
    })
  );

  app.get(
    "/api/scan",
    wrap(async (_req, res) => {
      const scan = await db.latestScan();
      const body: ScanResponse = scan ?? { ranAt: null, items: [], sources: [] };
      res.json(body);
    })
  );

  app.get(
    "/api/leaderboard",
    wrap(async (_req, res) => {
      const epoch = await db.getOpenEpoch();
      res.json({ leaderboard: await db.leaderboard(epoch?.id ?? null, 25) });
    })
  );

  app.get(
    "/api/player/:wallet",
    wrap(async (req, res) => {
      const wallet = req.params.wallet;
      const [posts, epoch] = await Promise.all([db.postsByWallet(wallet), db.getOpenEpoch()]);
      const ranks = await db.leaderboard(epoch?.id ?? null, 100);
      const mine = ranks.find((r) => r.wallet === wallet);
      const rankIndex = ranks.findIndex((r) => r.wallet === wallet);
      const lifetime = mine?.lifetimePoints ?? posts.filter((p) => p.status === "approved").reduce((s, p) => s + p.points, 0);
      const body: PlayerResponse = {
        wallet,
        lifetimePoints: lifetime,
        epochPoints: mine?.epochPoints ?? 0,
        tier: tierFor(lifetime),
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
        posts,
      };
      res.json(body);
    })
  );

  app.get(
    "/api/feed",
    wrap(async (_req, res) => {
      const [claims, buybacks, scan] = await Promise.all([
        db.recentClaims(8),
        db.recentBuybacks(8),
        db.latestScan(),
      ]);
      const events: FeedEvent[] = [];
      for (const c of claims) {
        events.push({
          at: c.claimed_at,
          kind: "claim",
          text: `CREATOR FEES CLAIMED +${(Number(c.lamports) / 1e9).toFixed(3)} SOL — 50% BUYBACK / 50% REWARDS`,
        });
      }
      for (const b of buybacks) {
        events.push({
          at: b.executed_at,
          kind: "buyback",
          text:
            b.status === "sent"
              ? `BUYBACK EXECUTED — ${(Number(b.lamports_spent) / 1e9).toFixed(3)} SOL OFF THE MARKET`
              : `BUYBACK ${String(b.status).toUpperCase()} — ${b.note ?? ""}`,
        });
      }
      if (scan) {
        events.push({
          at: scan.ranAt,
          kind: "scan",
          text: `ATTENTION SCAN COMPLETE — ${scan.items.length} SIGNALS INDEXED`,
        });
      }
      events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      res.json({ events: events.slice(0, 20) });
    })
  );

  // ── attention points ──────────────────────────────────────────────────

  app.post(
    "/api/attention/submit",
    wrap(async (req, res) => {
      const { wallet, url, signature } = req.body ?? {};
      if (typeof wallet !== "string" || typeof url !== "string" || typeof signature !== "string") {
        return res.status(400).json({ error: "wallet, url and signature are required" });
      }
      if (!isValidPostUrl(url)) {
        return res.status(400).json({ error: "url must be an x.com/twitter.com status link" });
      }
      if (!verifyWalletSignature(submitPostMessage(url, wallet), wallet, signature)) {
        return res.status(401).json({ error: "signature does not verify" });
      }

      const epoch = await ensureOpenEpoch(config, db);
      const post = await db.insertPost(wallet, url, signature, epoch.id).catch((err) => {
        throw Object.assign(new Error(err.message), { public: true });
      });

      // Auto-verify through the X API when a token is configured.
      let verdictNote = "queued for review — points land on approval";
      try {
        const verdict = await autoVerifyPost(config, url);
        if (verdict) {
          await db.reviewPost(post.id, verdict.verified ? "approved" : "denied", verdict.points, verdict.note);
          verdictNote = verdict.verified
            ? `auto-verified: +${verdict.points} attention points`
            : `denied: ${verdict.note}`;
        }
      } catch (err) {
        console.warn("[points] auto-verify unavailable, left pending:", (err as Error).message);
      }

      res.json({ ok: true, id: post.id, note: verdictNote });
    })
  );

  // ── ads ───────────────────────────────────────────────────────────────

  app.get(
    "/api/ads",
    wrap(async (_req, res) => {
      const ads = await db.activeAds();
      res.json({
        ads: ads.map((a) => ({ headline: a.headline, url: a.url, endsAt: a.endsAt })),
        priceLamportsPerDay: String(config.adPriceLamportsPerDay),
        treasury: config.treasuryKeypair.publicKey.toBase58(),
      });
    })
  );

  app.post(
    "/api/ads/book",
    wrap(async (req, res) => {
      const { wallet, headline, url, days, signature } = req.body ?? {};
      const nDays = Number(days);
      if (
        typeof wallet !== "string" ||
        typeof headline !== "string" ||
        typeof url !== "string" ||
        typeof signature !== "string" ||
        !Number.isInteger(nDays)
      ) {
        return res.status(400).json({ error: "wallet, headline, url, days and signature are required" });
      }
      if (headline.length < 4 || headline.length > 80) {
        return res.status(400).json({ error: "headline must be 4-80 characters" });
      }
      if (nDays < 1 || nDays > 30) {
        return res.status(400).json({ error: "days must be 1-30" });
      }
      try {
        const u = new URL(url);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ error: "url must be a valid http(s) link" });
      }
      if (!verifyWalletSignature(bookAdMessage(headline, nDays, wallet), wallet, signature)) {
        return res.status(401).json({ error: "signature does not verify" });
      }

      const price = BigInt(config.adPriceLamportsPerDay) * BigInt(nDays);
      const ad = await db.insertAd({
        wallet,
        headline,
        url,
        days: nDays,
        priceLamports: price.toString(),
        bookingCode: `ATTN-AD-${randomBytes(4).toString("hex").toUpperCase()}`,
      });
      res.json({
        ok: true,
        bookingId: ad.id,
        bookingCode: ad.bookingCode,
        priceLamports: price.toString(),
        payTo: config.treasuryKeypair.publicKey.toBase58(),
        instructions: `Send exactly ${Number(price) / 1e9} SOL to the treasury, then POST /api/ads/confirm with the transaction signature.`,
      });
    })
  );

  app.post(
    "/api/ads/confirm",
    wrap(async (req, res) => {
      const { bookingId, txSignature } = req.body ?? {};
      if (!Number.isInteger(Number(bookingId)) || typeof txSignature !== "string") {
        return res.status(400).json({ error: "bookingId and txSignature are required" });
      }
      const ad = await db.getAd(Number(bookingId));
      if (!ad) return res.status(404).json({ error: "booking not found" });
      if (ad.status !== "pending_payment") {
        return res.status(409).json({ error: `booking is ${ad.status}` });
      }
      if (await db.adByPaymentSignature(txSignature)) {
        return res.status(409).json({ error: "that payment signature is already used" });
      }

      const verdict = await verifyPaymentToTreasury(
        connection,
        txSignature,
        config.treasuryKeypair.publicKey,
        BigInt(ad.priceLamports)
      );
      if (!verdict.ok) return res.status(402).json({ error: verdict.reason });

      await db.activateAd(ad.id, txSignature, ad.days);

      // Revenue split: 90% credited to buybacks, 10% paid out to the dev wallet.
      const price = BigInt(ad.priceLamports);
      const toBuyback = (price * BigInt(Math.round(config.revenueBuybackShare * 10_000))) / 10_000n;
      const toDev = price - toBuyback;
      await db.insertLedger("buyback", toBuyback, `ad revenue #${ad.id}`, txSignature);
      await db.insertLedger("dev", toDev, `ad revenue #${ad.id}`, txSignature);
      console.log(`[ads] ad #${ad.id} live — revenue split ${toBuyback} buyback / ${toDev} dev`);

      res.json({ ok: true, status: "active", runsUntil: ad.days + " day(s) from now" });
    })
  );

  // ── admin ─────────────────────────────────────────────────────────────

  const requireAdmin = (req: Request, res: Response): boolean => {
    if (req.header("x-admin-key") !== config.adminKey) {
      res.status(401).json({ error: "bad admin key" });
      return false;
    }
    return true;
  };

  app.get(
    "/api/admin/pending-posts",
    wrap(async (req, res) => {
      if (!requireAdmin(req, res)) return;
      res.json({ posts: await db.pendingPosts() });
    })
  );

  app.post(
    "/api/admin/review-post",
    wrap(async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const { id, action, points, note } = req.body ?? {};
      if (!Number.isInteger(Number(id)) || !["approve", "deny"].includes(action)) {
        return res.status(400).json({ error: "id and action (approve|deny) required" });
      }
      const pts = action === "approve" ? Math.max(1, Math.min(10_000, Number(points) || 100)) : 0;
      await db.reviewPost(Number(id), action === "approve" ? "approved" : "denied", pts, note);
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/admin/review-ad",
    wrap(async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const { id } = req.body ?? {};
      if (!Number.isInteger(Number(id))) return res.status(400).json({ error: "id required" });
      await db.setAdStatus(Number(id), "rejected");
      res.json({ ok: true });
    })
  );

  return app;
}
